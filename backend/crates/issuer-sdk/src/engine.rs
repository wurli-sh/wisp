use std::sync::Arc;

use serde_json::Value;
use wisp_types::{ProofPackage, Roots};

use crate::model::*;
use crate::ports::*;
use crate::proof::{normalize_wallet_hex, roots_match};
#[derive(Clone, Debug, Default)]
pub struct IssuerEngineOptions {
    pub compliance_contract_id: Option<String>,
    pub issuer_name: Option<String>,
}

pub struct IssuerEngine {
    repository: Arc<dyn IssuerRepository>,
    identity_provider: Arc<dyn IdentityProviderAdapter>,
    destination_policy: Arc<dyn DestinationPolicy>,
    root_publisher: Arc<dyn RootPublisher>,
    proof_builder: Arc<dyn ProofPackageBuilder>,
    eligibility_policy: Arc<dyn EligibilityPolicy>,
    clock: Arc<dyn Clock>,
    options: IssuerEngineOptions,
}

pub struct IssuerEngineBuilder {
    repository: Arc<dyn IssuerRepository>,
    identity_provider: Arc<dyn IdentityProviderAdapter>,
    destination_policy: Arc<dyn DestinationPolicy>,
    root_publisher: Arc<dyn RootPublisher>,
    proof_builder: Arc<dyn ProofPackageBuilder>,
    eligibility_policy: Arc<dyn EligibilityPolicy>,
    clock: Arc<dyn Clock>,
    options: IssuerEngineOptions,
}

impl IssuerEngineBuilder {
    pub fn new(repository: Arc<dyn IssuerRepository>) -> Self {
        Self {
            repository,
            identity_provider: Arc::new(DefaultIdentityProviderAdapter),
            destination_policy: Arc::new(EnabledDestinationPolicy),
            root_publisher: Arc::new(NoopRootPublisher),
            proof_builder: Arc::new(CanonicalProofPackageBuilder),
            eligibility_policy: Arc::new(JurisdictionEligibilityPolicy),
            clock: Arc::new(SystemClock),
            options: IssuerEngineOptions::default(),
        }
    }

    pub fn identity_provider(mut self, adapter: Arc<dyn IdentityProviderAdapter>) -> Self {
        self.identity_provider = adapter;
        self
    }

    pub fn destination_policy(mut self, policy: Arc<dyn DestinationPolicy>) -> Self {
        self.destination_policy = policy;
        self
    }

    pub fn root_publisher(mut self, publisher: Arc<dyn RootPublisher>) -> Self {
        self.root_publisher = publisher;
        self
    }

    pub fn proof_builder(mut self, builder: Arc<dyn ProofPackageBuilder>) -> Self {
        self.proof_builder = builder;
        self
    }

    pub fn eligibility_policy(mut self, policy: Arc<dyn EligibilityPolicy>) -> Self {
        self.eligibility_policy = policy;
        self
    }

    pub fn clock(mut self, clock: Arc<dyn Clock>) -> Self {
        self.clock = clock;
        self
    }

    pub fn options(mut self, options: IssuerEngineOptions) -> Self {
        self.options = options;
        self
    }

    pub fn build(self) -> IssuerEngine {
        IssuerEngine {
            repository: self.repository,
            identity_provider: self.identity_provider,
            destination_policy: self.destination_policy,
            root_publisher: self.root_publisher,
            proof_builder: self.proof_builder,
            eligibility_policy: self.eligibility_policy,
            clock: self.clock,
            options: self.options,
        }
    }
}

impl IssuerEngine {
    pub async fn bootstrap_issuer(
        &self,
        request: BootstrapIssuerRequest,
    ) -> Result<BootstrapIssuerResult, String> {
        let corridors = self.repository.list_corridors().await?;
        let mut plans = Vec::with_capacity(corridors.len());
        for corridor in corridors {
            plans.push(self.plan_publish(corridor.id).await?);
        }
        Ok(BootstrapIssuerResult {
            issuer_name: request.issuer_name.or_else(|| self.options.issuer_name.clone()),
            corridor_plans: plans,
        })
    }

    pub async fn upsert_approval_from_event(
        &self,
        provider: &str,
        event_key: &str,
        payload: Value,
    ) -> Result<IssuerUser, String> {
        let decision = self
            .identity_provider
            .normalize_event(provider, event_key, &payload)?;
        self.repository.upsert_approval(decision).await
    }

    pub async fn upsert_approval(&self, decision: KycDecision) -> Result<IssuerUser, String> {
        self.repository.upsert_approval(decision).await
    }

    pub async fn plan_publish(&self, corridor_id: u32) -> Result<PublishPlan, String> {
        let corridor = self
            .repository
            .get_corridor(corridor_id)
            .await?
            .ok_or_else(|| format!("unknown corridor id: {corridor_id}"))?;
        let computed_roots = self.compute_roots_for_corridor(corridor_id).await?;
        let latest_snapshot = self.repository.latest_root_snapshot(Some(corridor_id)).await?;
        let (roots_state, mut reasons) =
            self.evaluate_roots_state(&corridor, latest_snapshot.as_ref(), &computed_roots);
        let next_action = match roots_state {
            RootsState::Active => NextAction::None,
            RootsState::Missing | RootsState::Stale | RootsState::Failed => NextAction::PublishRoots,
            RootsState::Publishing => NextAction::None,
        };
        if !corridor.enabled {
            reasons.push(format!("corridor {} is disabled", corridor.id));
        }
        Ok(PublishPlan {
            corridor_id,
            roots_state,
            next_action,
            reasons,
            computed_roots: Some(computed_roots),
            latest_snapshot,
        })
    }

    pub async fn ensure_roots_current(&self, corridor_id: u32) -> Result<PublishOutcome, String> {
        let plan = self.plan_publish(corridor_id).await?;
        if plan.roots_state == RootsState::Active {
            let snapshot = plan
                .latest_snapshot
                .ok_or_else(|| "active roots snapshot missing".to_string())?;
            return Ok(PublishOutcome {
                snapshot_id: snapshot.id,
                corridor_id,
                roots_state: RootsState::Active,
                message: snapshot.publish_message,
            });
        }
        let roots = plan
            .computed_roots
            .ok_or_else(|| "computed roots missing from publish plan".to_string())?;
        let snapshot = self
            .repository
            .create_pending_root_snapshot(corridor_id, &roots, self.clock.now_unix())
            .await?;
        match self.root_publisher.publish_roots(&roots, corridor_id) {
            Ok(message) => {
                self.repository
                    .activate_root_snapshot(
                        snapshot.id,
                        message.clone(),
                        self.options.compliance_contract_id.clone(),
                        self.clock.now_unix(),
                    )
                    .await?;
                Ok(PublishOutcome {
                    snapshot_id: snapshot.id,
                    corridor_id,
                    roots_state: RootsState::Active,
                    message: Some(message),
                })
            }
            Err(err) => {
                self.repository
                    .fail_root_snapshot(snapshot.id, err.clone())
                    .await?;
                Ok(PublishOutcome {
                    snapshot_id: snapshot.id,
                    corridor_id,
                    roots_state: RootsState::Failed,
                    message: Some(err),
                })
            }
        }
    }

    pub async fn compute_roots_for_corridor(&self, corridor_id: u32) -> Result<Roots, String> {
        let corridor = self
            .repository
            .get_corridor(corridor_id)
            .await?
            .ok_or_else(|| format!("unknown corridor id: {corridor_id}"))?;
        let users = self.repository.list_users().await?;
        let active_users = users
            .iter()
            .filter(|user| user.enabled)
            .cloned()
            .collect::<Vec<_>>();
        let destinations = self.repository.list_enabled_destinations(corridor_id).await?;
        let sender = active_users
            .iter()
            .find(|user| {
                user.jurisdiction
                    .eq_ignore_ascii_case(&corridor.source_country)
            })
            .cloned()
            .or_else(|| active_users.first().cloned())
            .ok_or_else(|| "no active issuer users found".to_string())?;
        let credential = self
            .repository
            .find_active_credential(sender.id)
            .await?
            .ok_or_else(|| "no active credential found".to_string())?;
        let destination = destinations
            .first()
            .cloned()
            .ok_or_else(|| "no approved destinations found".to_string())?;
        let proof = self.proof_builder.build(
            &sender,
            &credential,
            &corridor,
            &destination,
            &active_users,
            &destinations,
            "1".into(),
        )?;
        Ok(proof.roots)
    }

    pub async fn issue_proof_package(
        &self,
        request: &ProofPackageRequest,
    ) -> Result<ProofPackage, String> {
        let sender_wallet = normalize_wallet_hex(&request.sender_wallet)?;
        let recipient_wallet = normalize_wallet_hex(&request.recipient_wallet)?;
        let sender = self
            .repository
            .find_active_user_by_wallet(&sender_wallet)
            .await?
            .ok_or_else(|| "approved sender not found".to_string())?;
        if !sender.sanctions_clear {
            return Err("sender is not sanctions clear".into());
        }
        let credential = self
            .repository
            .find_active_credential(sender.id)
            .await?
            .ok_or_else(|| "active credential not found".to_string())?;
        let corridors = self.repository.list_corridors().await?;
        let eligible = self
            .eligibility_policy
            .eligible_corridors(&sender, &corridors);
        if !eligible.contains(&request.corridor_id) {
            return Err(format!(
                "sender jurisdiction {} is not eligible for corridor {}",
                sender.jurisdiction, request.corridor_id
            ));
        }
        let corridor = self
            .repository
            .get_corridor(request.corridor_id)
            .await?
            .ok_or_else(|| format!("unknown corridor id: {}", request.corridor_id))?;
        if !corridor.enabled {
            return Err(format!("corridor {} is disabled", corridor.id));
        }
        let readiness = self
            .get_issuance_readiness(
                &sender_wallet,
                request.corridor_id,
                Some(recipient_wallet.as_str()),
            )
            .await?;
        let require_roots = self.options.compliance_contract_id.is_some();
        let blocking_reasons = if require_roots {
            readiness.reasons.clone()
        } else {
            readiness
                .reasons
                .iter()
                .filter(|reason| {
                    !reason.contains("roots")
                        && !reason.contains("published roots")
                        && !reason.contains("compliance contract")
                })
                .cloned()
                .collect::<Vec<_>>()
        };
        if let Some(reason) = blocking_reasons.first() {
            return Err(reason.clone());
        }
        let destination = self
            .repository
            .find_destination(request.corridor_id, &recipient_wallet)
            .await?;
        self.destination_policy
            .validate_destination(&corridor, destination.as_ref())?;
        let users = self
            .repository
            .list_users()
            .await?
            .into_iter()
            .filter(|user| user.enabled)
            .collect::<Vec<_>>();
        let destinations = self
            .repository
            .list_enabled_destinations(request.corridor_id)
            .await?;
        self.proof_builder.build(
            &sender,
            &credential,
            &corridor,
            &destination.ok_or_else(|| "recipient not approved for corridor".to_string())?,
            &users,
            &destinations,
            request.amount.clone(),
        )
    }

    pub async fn get_issuance_readiness(
        &self,
        wallet: &str,
        corridor_id: u32,
        recipient: Option<&str>,
    ) -> Result<IssuanceReadiness, String> {
        let wallet = normalize_wallet_hex(wallet)?;
        let recipient = recipient
            .map(normalize_wallet_hex)
            .transpose()?;
        let sender = self
            .repository
            .find_active_user_by_wallet(&wallet)
            .await?;
        let corridor = self.repository.get_corridor(corridor_id).await?;
        let mut reasons = Vec::new();
        let mut next_action = NextAction::None;

        let Some(corridor) = corridor else {
            return Ok(IssuanceReadiness {
                wallet,
                corridor_id,
                recipient,
                ready: false,
                roots_state: RootsState::Missing,
                next_action: NextAction::RegisterCorridor,
                reasons: vec![format!("unknown corridor id: {corridor_id}")],
            });
        };

        let Some(sender) = sender else {
            return Ok(IssuanceReadiness {
                wallet,
                corridor_id,
                recipient,
                ready: false,
                roots_state: RootsState::Missing,
                next_action: NextAction::None,
                reasons: vec!["approved sender not found".into()],
            });
        };

        let credential = self.repository.find_active_credential(sender.id).await?;
        if credential.is_none() {
            reasons.push("active credential not found".into());
        }
        if !sender.sanctions_clear {
            reasons.push("sender is not sanctions clear".into());
        }
        let corridors = self.repository.list_corridors().await?;
        let eligible = self
            .eligibility_policy
            .eligible_corridors(&sender, &corridors);
        if !eligible.contains(&corridor_id) {
            reasons.push(format!(
                "sender jurisdiction {} is not eligible for corridor {}",
                sender.jurisdiction, corridor_id
            ));
        }
        if !corridor.enabled {
            reasons.push(format!("corridor {} is disabled", corridor.id));
            next_action = NextAction::RegisterCorridor;
        }
        let destination = if let Some(recipient) = recipient.as_deref() {
            self.repository.find_destination(corridor_id, recipient).await?
        } else {
            self.repository
                .list_enabled_destinations(corridor_id)
                .await?
                .into_iter()
                .next()
        };
        if let Err(err) = self
            .destination_policy
            .validate_destination(&corridor, destination.as_ref())
        {
            reasons.push(err);
            next_action = NextAction::ApproveDestination;
        }
        let computed_roots = self.compute_roots_for_corridor(corridor_id).await?;
        let latest_snapshot = self.repository.latest_root_snapshot(Some(corridor_id)).await?;
        let (roots_state, root_reasons) =
            self.evaluate_roots_state(&corridor, latest_snapshot.as_ref(), &computed_roots);
        reasons.extend(root_reasons);
        if matches!(roots_state, RootsState::Missing | RootsState::Stale | RootsState::Failed) {
            next_action = NextAction::PublishRoots;
        }
        Ok(IssuanceReadiness {
            wallet,
            corridor_id,
            recipient,
            ready: reasons.is_empty(),
            roots_state,
            next_action,
            reasons,
        })
    }

    fn evaluate_roots_state(
        &self,
        corridor: &CorridorRecord,
        snapshot: Option<&RootSnapshotRecord>,
        roots: &Roots,
    ) -> (RootsState, Vec<String>) {
        let mut reasons = Vec::new();
        let state = match snapshot {
            Some(snapshot) if snapshot.publish_status == "active" => {
                if !roots_match(snapshot, roots) {
                    reasons.push(format!(
                        "published roots are stale for corridor {}. republish before issuing proofs",
                        corridor.id
                    ));
                    RootsState::Stale
                } else if snapshot.compliance_contract_id.as_deref()
                    != self.options.compliance_contract_id.as_deref()
                {
                    reasons.push(format!(
                        "published roots target a different compliance contract for corridor {}",
                        corridor.id
                    ));
                    RootsState::Stale
                } else {
                    RootsState::Active
                }
            }
            Some(snapshot) if snapshot.publish_status == "pending" => RootsState::Publishing,
            Some(snapshot) if snapshot.publish_status == "failed" => {
                reasons.push(
                    snapshot
                        .publish_message
                        .clone()
                        .unwrap_or_else(|| "roots publish failed".into()),
                );
                RootsState::Failed
            }
            _ => {
                reasons.push(format!(
                    "roots are not current for corridor {}. publish fresh roots before issuing proofs",
                    corridor.id
                ));
                RootsState::Missing
            }
        };
        (state, reasons)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::memory::InMemoryIssuerRepository;
    use serde_json::json;

    #[derive(Debug)]
    struct OkPublisher;

    impl RootPublisher for OkPublisher {
        fn publish_roots(&self, _roots: &Roots, corridor_id: u32) -> Result<String, String> {
            Ok(format!("published {corridor_id}"))
        }
    }

    fn seeded_repo() -> Arc<InMemoryIssuerRepository> {
        let repo = Arc::new(InMemoryIssuerRepository::new());
        repo.seed_corridor(CorridorRecord {
            id: 1,
            name: "US-MX".into(),
            source_country: "US".into(),
            dest_country: "MX".into(),
            enabled: true,
            asset_hex: "ffeeddccbbaa998877665544332211000123456789abcdeffedcba9876543210".into(),
            issuer_strkey: None,
            travel_rule_threshold: "0".into(),
        });
        repo.seed_destination(
            1,
            "102132435465768798a9babbdcedfe0f0f1e2d3c4b5a69788796a5b4c3d2e1f0",
        );
        repo
    }

    #[tokio::test]
    async fn custom_provider_adapter_can_ingest_without_http_shape() {
        let repo = seeded_repo();
        let engine = IssuerEngineBuilder::new(repo)
            .options(IssuerEngineOptions {
                compliance_contract_id: Some("CCOMPLIANCE".into()),
                issuer_name: None,
            })
            .build();
        let user = engine
            .upsert_approval(KycDecision {
                provider: "custom".into(),
                provider_ref: "abc".into(),
                enabled: true,
                subject: IssuerSubject {
                    wallet: "00112233445566778899aabbccddeeff1032547698badcfeefcdab8967452301"
                        .into(),
                    jurisdiction: "US".into(),
                    jurisdiction_code: 840,
                    metadata: json!({}),
                },
                credential: IssuerCredential {
                    credential_secret: "424242".into(),
                    credential_expiry: 2_000_000_000,
                    sanctions_clear: true,
                    enabled: true,
                },
            })
            .await
            .expect("upsert");
        assert_eq!(user.provider.as_deref(), Some("custom"));
    }

    #[tokio::test]
    async fn ensure_roots_current_returns_publish_decision() {
        let repo = seeded_repo();
        let engine = IssuerEngineBuilder::new(repo)
            .root_publisher(Arc::new(OkPublisher))
            .options(IssuerEngineOptions {
                compliance_contract_id: Some("CCOMPLIANCE".into()),
                issuer_name: None,
            })
            .build();
        engine
            .upsert_approval(KycDecision {
                provider: "fixture".into(),
                provider_ref: "demo".into(),
                enabled: true,
                subject: IssuerSubject {
                    wallet: "00112233445566778899aabbccddeeff1032547698badcfeefcdab8967452301"
                        .into(),
                    jurisdiction: "US".into(),
                    jurisdiction_code: 840,
                    metadata: json!({}),
                },
                credential: IssuerCredential {
                    credential_secret: "424242".into(),
                    credential_expiry: 2_000_000_000,
                    sanctions_clear: true,
                    enabled: true,
                },
            })
            .await
            .expect("upsert");
        let plan = engine.plan_publish(1).await.expect("plan");
        assert_eq!(plan.roots_state, RootsState::Missing);
        assert_eq!(plan.next_action, NextAction::PublishRoots);
        let outcome = engine.ensure_roots_current(1).await.expect("publish");
        assert_eq!(outcome.roots_state, RootsState::Active);
    }

    #[tokio::test]
    async fn issue_proof_package_rejects_when_roots_missing() {
        let repo = seeded_repo();
        let engine = IssuerEngineBuilder::new(repo)
            .options(IssuerEngineOptions {
                compliance_contract_id: Some("CCOMPLIANCE".into()),
                issuer_name: None,
            })
            .build();
        engine
            .upsert_approval(KycDecision {
                provider: "fixture".into(),
                provider_ref: "demo".into(),
                enabled: true,
                subject: IssuerSubject {
                    wallet: "00112233445566778899aabbccddeeff1032547698badcfeefcdab8967452301"
                        .into(),
                    jurisdiction: "US".into(),
                    jurisdiction_code: 840,
                    metadata: json!({}),
                },
                credential: IssuerCredential {
                    credential_secret: "424242".into(),
                    credential_expiry: 2_000_000_000,
                    sanctions_clear: true,
                    enabled: true,
                },
            })
            .await
            .expect("upsert");
        let err = engine
            .issue_proof_package(&ProofPackageRequest {
                sender_wallet:
                    "00112233445566778899aabbccddeeff1032547698badcfeefcdab8967452301".into(),
                recipient_wallet:
                    "102132435465768798a9babbdcedfe0f0f1e2d3c4b5a69788796a5b4c3d2e1f0".into(),
                amount: "100".into(),
                corridor_id: 1,
            })
            .await
            .expect_err("roots missing must reject");
        assert!(err.contains("roots"));
    }

    #[tokio::test]
    async fn no_implicit_background_publish_in_embedded_mode() {
        let repo = seeded_repo();
        let engine = IssuerEngineBuilder::new(repo.clone())
            .options(IssuerEngineOptions {
                compliance_contract_id: Some("CCOMPLIANCE".into()),
                issuer_name: None,
            })
            .build();
        engine
            .upsert_approval(KycDecision {
                provider: "fixture".into(),
                provider_ref: "demo".into(),
                enabled: true,
                subject: IssuerSubject {
                    wallet: "00112233445566778899aabbccddeeff1032547698badcfeefcdab8967452301"
                        .into(),
                    jurisdiction: "US".into(),
                    jurisdiction_code: 840,
                    metadata: json!({}),
                },
                credential: IssuerCredential {
                    credential_secret: "424242".into(),
                    credential_expiry: 2_000_000_000,
                    sanctions_clear: true,
                    enabled: true,
                },
            })
            .await
            .expect("upsert");
        let readiness = engine
            .get_issuance_readiness(
                "00112233445566778899aabbccddeeff1032547698badcfeefcdab8967452301",
                1,
                Some("102132435465768798a9babbdcedfe0f0f1e2d3c4b5a69788796a5b4c3d2e1f0"),
            )
            .await
            .expect("readiness");
        assert_eq!(readiness.roots_state, RootsState::Missing);
        assert!(repo
            .latest_root_snapshot(Some(1))
            .await
            .expect("snapshot")
            .is_none());
    }
}
