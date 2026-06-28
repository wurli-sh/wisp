use std::collections::{BTreeMap, BTreeSet};
use std::convert::TryFrom;
use std::str::FromStr;
use std::time::{SystemTime, UNIX_EPOCH};

use ark_bn254::Fr;
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use rand::random;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use stellar_strkey::ed25519::PublicKey as StrKeyPublicKey;
use wisp_crypto::{
    address_to_limbs, compute_corridor_config_hash, fr_to_canonical_decimal, mod_u128, mod_u64,
    poseidon2_hash1, poseidon2_hash2, sparse_sanctions_path, MERKLE_DEPTH,
};
use wisp_types::{
    Credential, DemoPackageMetadata, MerklePaths, Roots, TransferParams, EPOCH_LEN_SECS,
};

use crate::mock_kyc::{normalize_wallet_hex, validate_wallet_strkey, wallet_strkey_from_hex};
use crate::state::{CorridorDestinationRecord, CorridorRecord, IssuerUser};

const CHALLENGE_TTL_SECS: i64 = 300;
const SIGNED_MESSAGE_PREFIX: &[u8] = b"Stellar Signed Message:\n";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ChallengePurpose {
    ActivateCredential,
    ProofPackage,
}

impl ChallengePurpose {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ActivateCredential => "activate_credential",
            Self::ProofPackage => "proof_package",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChallengeRecord {
    pub id: String,
    pub wallet_hex: String,
    pub wallet_strkey: String,
    pub purpose: ChallengePurpose,
    pub message: String,
    pub payload: Value,
    pub nonce: String,
    pub expires_at: i64,
    pub consumed_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivatedCredential {
    pub id: i64,
    pub user_id: i64,
    pub wallet: String,
    pub credential_commitment: String,
    pub jurisdiction_code: u32,
    pub credential_expiry: u64,
    pub enabled: bool,
    pub activated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivationChallengeRequest {
    pub wallet: String,
    pub credential_commitment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChallengeResponse {
    pub challenge_id: String,
    pub message: String,
    pub expires_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivateCredentialRequest {
    pub challenge_id: String,
    pub signed_message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivateCredentialResponse {
    pub wallet: String,
    pub credential_commitment: String,
    pub activated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofPackageChallengeRequest {
    pub sender_wallet: String,
    pub recipient_wallet: String,
    pub amount: String,
    pub corridor_id: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedProofPackageRequest {
    pub challenge_id: String,
    pub signed_message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DraftWitnessPrivate {
    pub demo_unsafe: bool,
    pub transfer_nonce: String,
    pub jurisdiction: String,
    pub credential_expiry: String,
    pub sanctions_leaf_value: String,
    pub travel_rule_threshold: String,
    pub enabled: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofPackageDraft {
    pub credential: Credential,
    pub transfer: TransferParams,
    pub roots: Roots,
    pub paths: MerklePaths,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub demo: Option<DemoPackageMetadata>,
    pub witness_private: DraftWitnessPrivate,
    pub public_inputs: BTreeMap<String, String>,
}

#[derive(Debug, Clone)]
pub struct ProofContext {
    pub sender: IssuerUser,
    pub sender_credential: ActivatedCredential,
    pub corridor: CorridorRecord,
    pub destination: CorridorDestinationRecord,
    pub users: Vec<IssuerUser>,
    pub credentials: Vec<ActivatedCredential>,
    pub destinations: Vec<CorridorDestinationRecord>,
    pub amount: String,
    pub issuer_public_key: String,
}

pub fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time before unix epoch")
        .as_secs() as i64
}

pub fn validate_field_decimal(value: &str) -> Result<(), String> {
    let trimmed = value.trim();
    if trimmed.is_empty() || !trimmed.chars().all(|character| character.is_ascii_digit()) {
        return Err("invalid credential commitment".into());
    }
    let field = Fr::from_str(trimmed).map_err(|_| "invalid credential commitment".to_string())?;
    if fr_to_canonical_decimal(field) != trimmed {
        return Err("credential commitment must be a canonical field element".into());
    }
    Ok(())
}

pub fn build_challenge(
    purpose: ChallengePurpose,
    wallet: &str,
    payload: Value,
) -> Result<ChallengeRecord, String> {
    let wallet_hex = normalize_wallet_hex(wallet)?;
    let wallet_strkey = if wallet.trim().len() == 64 {
        wallet_strkey_from_hex(&wallet_hex)?
    } else {
        validate_wallet_strkey(wallet.trim())?;
        wallet.trim().to_string()
    };
    let challenge_id = uuid::Uuid::new_v4().to_string();
    let nonce = uuid::Uuid::new_v4().simple().to_string();
    let expires_at = now_unix() + CHALLENGE_TTL_SECS;
    let payload_sha256 = canonical_payload_hash(&payload)?;
    let message = [
        "WISP_AUTH".to_string(),
        format!("purpose={}", purpose.as_str()),
        format!("challenge_id={challenge_id}"),
        format!("wallet={wallet_strkey}"),
        format!("payload_sha256={payload_sha256}"),
        format!("nonce={nonce}"),
        format!("expires_at={expires_at}"),
    ]
    .join("\n");
    Ok(ChallengeRecord {
        id: challenge_id,
        wallet_hex,
        wallet_strkey,
        purpose,
        message,
        payload,
        nonce,
        expires_at,
        consumed_at: None,
    })
}

pub fn verify_signed_message(
    challenge: &ChallengeRecord,
    signed_message: &str,
) -> Result<(), String> {
    if now_unix() > challenge.expires_at {
        return Err("challenge expired".into());
    }
    let signature_bytes = BASE64_STANDARD
        .decode(signed_message.trim())
        .map_err(|_| "invalid signature encoding".to_string())?;
    let signature = Signature::try_from(signature_bytes.as_slice())
        .map_err(|_| "invalid signature length".to_string())?;
    let public_key = StrKeyPublicKey::from_string(&challenge.wallet_strkey)
        .map_err(|_| "invalid challenge wallet".to_string())?;
    let verifying_key =
        VerifyingKey::from_bytes(&public_key.0).map_err(|_| "invalid verifying key".to_string())?;
    let mut hasher = Sha256::new();
    hasher.update(SIGNED_MESSAGE_PREFIX);
    hasher.update(challenge.message.as_bytes());
    let digest = hasher.finalize();
    verifying_key
        .verify(&digest, &signature)
        .map_err(|_| "invalid signature".to_string())
}

pub fn build_proof_package_draft(ctx: ProofContext) -> Result<ProofPackageDraft, String> {
    let sender_bytes =
        hex::decode(&ctx.sender.wallet).map_err(|_| "invalid sender wallet".to_string())?;
    let recipient_bytes = hex::decode(&ctx.destination.address)
        .map_err(|_| "invalid destination wallet".to_string())?;
    let asset_bytes =
        hex::decode(&ctx.corridor.asset_hex).map_err(|_| "invalid corridor asset".to_string())?;
    let issuer_bytes = StrKeyPublicKey::from_string(ctx.issuer_public_key.trim())
        .map_err(|_| "invalid issuer public key".to_string())?
        .0
        .to_vec();

    let sender_limbs = address_to_limbs(&sender_bytes);
    let recipient_limbs = address_to_limbs(&recipient_bytes);
    let asset_limbs = address_to_limbs(&asset_bytes);
    let issuer_limbs = address_to_limbs(&issuer_bytes);

    let credential_by_wallet = ctx
        .credentials
        .iter()
        .filter(|credential| credential.enabled)
        .map(|credential| (credential.wallet.clone(), credential))
        .collect::<BTreeMap<_, _>>();

    let now = now_unix() as u64;
    let active_users = ctx
        .users
        .iter()
        .filter(|user| user.enabled && user.sanctions_clear && user.credential_expiry >= now)
        .filter_map(|user| {
            credential_by_wallet
                .get(&user.wallet)
                .filter(|credential| {
                    credential.jurisdiction_code == user.jurisdiction_code
                        && credential.credential_expiry == user.credential_expiry
                })
                .map(|credential| (user.clone(), (*credential).clone()))
        })
        .collect::<Vec<_>>();

    let mut membership_leaves = active_users
        .iter()
        .map(|(user, credential)| {
            let leaf = decimal_to_fr(&credential.credential_commitment)?;
            Ok::<_, String>((user.wallet.clone(), leaf))
        })
        .collect::<Result<Vec<_>, _>>()?;
    membership_leaves.sort_by(|a, b| a.0.cmp(&b.0));

    let sender_index = membership_leaves
        .iter()
        .position(|(wallet, _)| wallet == &ctx.sender.wallet)
        .ok_or_else(|| "sender missing from credential membership set".to_string())?;
    let membership_tree = build_merkle_tree(
        &membership_leaves
            .iter()
            .map(|(_, leaf)| *leaf)
            .collect::<Vec<_>>(),
        sender_index,
    );

    let jurisdiction_codes = active_users
        .iter()
        .map(|(user, _)| user.jurisdiction_code)
        .collect::<BTreeSet<_>>();
    let jurisdiction_order = jurisdiction_codes.into_iter().collect::<Vec<_>>();
    let jurisdiction_index = jurisdiction_order
        .iter()
        .position(|code| *code == ctx.sender.jurisdiction_code)
        .ok_or_else(|| "sender jurisdiction missing from approved set".to_string())?;
    let jurisdiction_leaves = jurisdiction_order
        .iter()
        .map(|code| poseidon2_hash1(mod_u128(*code as u128)))
        .collect::<Vec<_>>();
    let jurisdiction_tree = build_merkle_tree(&jurisdiction_leaves, jurisdiction_index);

    let source_jurisdiction_leaf = poseidon2_hash1(mod_u128(default_jurisdiction_code(
        &ctx.corridor.source_country,
    ) as u128));
    let source_tree = build_merkle_tree(&[source_jurisdiction_leaf], 0);

    let destination_order = ctx
        .destinations
        .iter()
        .filter(|item| item.enabled)
        .map(|item| item.address.clone())
        .into_iter()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    let destination_index = destination_order
        .iter()
        .position(|address| address == &ctx.destination.address)
        .ok_or_else(|| "destination missing from approved registry".to_string())?;
    let destination_leaves = destination_order
        .iter()
        .map(|address| {
            let bytes = hex::decode(address).map_err(|_| "invalid destination".to_string())?;
            let limbs = address_to_limbs(&bytes);
            Ok::<_, String>(poseidon2_hash2(limbs.lo, limbs.hi))
        })
        .collect::<Result<Vec<_>, _>>()?;
    let destination_tree = build_merkle_tree(&destination_leaves, destination_index);

    let sanctions = sparse_sanctions_path(sender_limbs.lo, sender_limbs.hi, MERKLE_DEPTH);
    let epoch = (now_unix() as u64) / EPOCH_LEN_SECS;
    let parsed_amount = ctx
        .amount
        .parse::<u64>()
        .map_err(|_| format!("invalid amount: {}", ctx.amount))?;
    if parsed_amount == 0 {
        return Err("amount must be greater than zero".into());
    }

    let transfer_nonce = random::<u128>();
    let corridor_config_hash = compute_corridor_config_hash(
        mod_u64(ctx.corridor.id as u64),
        source_tree.root,
        destination_tree.root,
        mod_u64(u64::from(ctx.corridor.enabled)),
        mod_u64(
            ctx.corridor
                .travel_rule_threshold
                .parse::<u64>()
                .unwrap_or_default(),
        ),
    );

    let mut public_inputs = BTreeMap::from([
        (
            "merkle_root".to_string(),
            fr_to_canonical_decimal(membership_tree.root),
        ),
        (
            "asset_lo".to_string(),
            fr_to_canonical_decimal(asset_limbs.lo),
        ),
        (
            "asset_hi".to_string(),
            fr_to_canonical_decimal(asset_limbs.hi),
        ),
        (
            "sender_lo".to_string(),
            fr_to_canonical_decimal(sender_limbs.lo),
        ),
        (
            "sender_hi".to_string(),
            fr_to_canonical_decimal(sender_limbs.hi),
        ),
        ("epoch".to_string(), epoch.to_string()),
        (
            "recipient_lo".to_string(),
            fr_to_canonical_decimal(recipient_limbs.lo),
        ),
        (
            "recipient_hi".to_string(),
            fr_to_canonical_decimal(recipient_limbs.hi),
        ),
        ("amount".to_string(), parsed_amount.to_string()),
        (
            "sanctions_root".to_string(),
            fr_to_canonical_decimal(sanctions.root),
        ),
        (
            "jurisdiction_root".to_string(),
            fr_to_canonical_decimal(jurisdiction_tree.root),
        ),
        (
            "timestamp".to_string(),
            (epoch * EPOCH_LEN_SECS).to_string(),
        ),
        ("corridor_id".to_string(), ctx.corridor.id.to_string()),
        (
            "corridor_config_hash".to_string(),
            fr_to_canonical_decimal(corridor_config_hash),
        ),
        (
            "source_jurisdiction_root".to_string(),
            fr_to_canonical_decimal(source_tree.root),
        ),
        (
            "dest_address_root".to_string(),
            fr_to_canonical_decimal(destination_tree.root),
        ),
        (
            "issuer_lo".to_string(),
            fr_to_canonical_decimal(issuer_limbs.lo),
        ),
        (
            "issuer_hi".to_string(),
            fr_to_canonical_decimal(issuer_limbs.hi),
        ),
    ]);
    public_inputs.insert("nullifier".into(), String::new());

    Ok(ProofPackageDraft {
        credential: Credential {
            wallet: ctx.sender.wallet.clone(),
            jurisdiction: ctx.sender.jurisdiction.clone(),
            jurisdiction_code: ctx.sender.jurisdiction_code,
            credential_expiry: ctx.sender.credential_expiry,
            sanctions_clear: ctx.sender.sanctions_clear,
            corridor_eligibility: ctx
                .sender
                .metadata
                .get("corridor_eligibility")
                .and_then(Value::as_array)
                .map(|items| {
                    items
                        .iter()
                        .filter_map(Value::as_u64)
                        .map(|value| value as u32)
                        .collect()
                })
                .unwrap_or_default(),
            credential_commitment: Some(ctx.sender_credential.credential_commitment.clone()),
        },
        transfer: TransferParams {
            asset: ctx.corridor.asset_hex.clone(),
            sender: ctx.sender.wallet.clone(),
            recipient: ctx.destination.address.clone(),
            amount: ctx.amount,
            corridor_id: ctx.corridor.id,
            epoch,
            timestamp: epoch * EPOCH_LEN_SECS,
        },
        roots: Roots {
            merkle_root: fr_to_canonical_decimal(membership_tree.root),
            sanctions_root: fr_to_canonical_decimal(sanctions.root),
            jurisdiction_root: fr_to_canonical_decimal(jurisdiction_tree.root),
            source_jurisdiction_root: fr_to_canonical_decimal(source_tree.root),
            dest_address_root: fr_to_canonical_decimal(destination_tree.root),
            corridor_config_hash: fr_to_canonical_decimal(corridor_config_hash),
        },
        paths: MerklePaths {
            membership: membership_tree.path,
            membership_indices: membership_tree.path_indices,
            sanctions: sanctions
                .path
                .iter()
                .map(|fr| fr_to_canonical_decimal(*fr))
                .collect(),
            sanctions_indices: sanctions.path_indices,
            jurisdiction: jurisdiction_tree.path,
            jurisdiction_indices: jurisdiction_tree.path_indices,
            source_jurisdiction: source_tree.path,
            source_jurisdiction_indices: source_tree.path_indices,
            dest_address: destination_tree.path,
            dest_address_indices: destination_tree.path_indices,
        },
        demo: Some(DemoPackageMetadata {
            sender_strkey: wallet_strkey_from_hex(&ctx.sender.wallet).ok(),
            recipient_strkey: wallet_strkey_from_hex(&ctx.destination.address).ok(),
            asset_strkey: None,
            issuer_strkey: ctx.corridor.issuer_strkey.clone(),
            source_country: Some(ctx.corridor.source_country.clone()),
            dest_country: Some(ctx.corridor.dest_country.clone()),
        }),
        witness_private: DraftWitnessPrivate {
            demo_unsafe: false,
            transfer_nonce: transfer_nonce.to_string(),
            jurisdiction: ctx.sender_credential.jurisdiction_code.to_string(),
            credential_expiry: ctx.sender_credential.credential_expiry.to_string(),
            sanctions_leaf_value: "0".into(),
            travel_rule_threshold: ctx
                .corridor
                .travel_rule_threshold
                .parse::<u64>()
                .unwrap_or_default()
                .to_string(),
            enabled: u64::from(ctx.corridor.enabled).to_string(),
        },
        public_inputs,
    })
}

pub fn activation_payload(commitment: &str) -> Value {
    json!({ "credential_commitment": commitment })
}

pub fn proof_payload(req: &ProofPackageChallengeRequest) -> Value {
    json!({
        "sender_wallet": req.sender_wallet,
        "recipient_wallet": req.recipient_wallet,
        "amount": req.amount,
        "corridor_id": req.corridor_id,
    })
}

fn canonical_payload_hash(payload: &Value) -> Result<String, String> {
    let bytes = serde_json::to_vec(payload).map_err(|err| err.to_string())?;
    let digest = Sha256::digest(bytes);
    Ok(hex::encode(digest))
}

fn decimal_to_fr(value: &str) -> Result<Fr, String> {
    Fr::from_str(value).map_err(|_| "invalid field element".to_string())
}

fn default_jurisdiction_code(country: &str) -> u32 {
    match country.trim().to_ascii_uppercase().as_str() {
        "US" => 840,
        "IN" => 356,
        "SG" => 702,
        "GB" => 826,
        _ => 0,
    }
}

#[derive(Debug)]
struct MerkleTreeResult {
    root: Fr,
    path: Vec<String>,
    path_indices: Vec<u8>,
}

fn build_merkle_tree(leaves: &[Fr], index: usize) -> MerkleTreeResult {
    let zero_hashes = wisp_crypto::compute_zero_hashes(MERKLE_DEPTH);
    let mut level = if leaves.is_empty() {
        vec![zero_hashes[0]]
    } else {
        leaves.to_vec()
    };
    let mut path = Vec::with_capacity(MERKLE_DEPTH);
    let mut path_indices = Vec::with_capacity(MERKLE_DEPTH);
    let mut current_index = index;

    for depth in 0..MERKLE_DEPTH {
        if level.len() % 2 == 1 {
            level.push(zero_hashes[depth]);
        }
        let sibling_index = if current_index % 2 == 0 {
            current_index + 1
        } else {
            current_index - 1
        };
        path.push(fr_to_canonical_decimal(level[sibling_index]));
        path_indices.push((current_index % 2) as u8);

        level = level
            .chunks(2)
            .map(|chunk| wisp_crypto::hash2(chunk[0], chunk[1]))
            .collect();
        current_index /= 2;
    }

    MerkleTreeResult {
        root: level[0],
        path,
        path_indices,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};
    use serde_json::json;
    use wisp_crypto::compute_credential_commitment;

    #[test]
    fn verify_signed_message_accepts_valid_sep53_signature() {
        let signing_key = SigningKey::from_bytes(&[7u8; 32]);
        let wallet = StrKeyPublicKey(signing_key.verifying_key().to_bytes()).to_string();
        let challenge = build_challenge(
            ChallengePurpose::ActivateCredential,
            &wallet,
            json!({ "credential_commitment": "123" }),
        )
        .expect("challenge");

        let mut hasher = Sha256::new();
        hasher.update(SIGNED_MESSAGE_PREFIX);
        hasher.update(challenge.message.as_bytes());
        let digest = hasher.finalize();
        let signature = signing_key.sign(&digest);
        let encoded = BASE64_STANDARD.encode(signature.to_bytes());

        verify_signed_message(&challenge, &encoded).expect("signature valid");
    }

    #[test]
    fn build_proof_package_draft_omits_secret_and_sets_issuer_inputs() {
        let issuer_key = SigningKey::from_bytes(&[9u8; 32]);
        let issuer_strkey = StrKeyPublicKey(issuer_key.verifying_key().to_bytes()).to_string();
        let sender_key = SigningKey::from_bytes(&[11u8; 32]);
        let sender_hex = hex::encode(sender_key.verifying_key().to_bytes());
        let recipient_hex = hex::encode([13u8; 32]);
        let asset_hex = hex::encode([15u8; 32]);

        let issuer_limbs = address_to_limbs(&issuer_key.verifying_key().to_bytes());
        let sender_limbs = address_to_limbs(&sender_key.verifying_key().to_bytes());
        let commitment = fr_to_canonical_decimal(compute_credential_commitment(
            issuer_limbs.lo,
            issuer_limbs.hi,
            sender_limbs.lo,
            sender_limbs.hi,
            mod_u128(12345),
            mod_u128(840),
            mod_u64(4_102_444_800),
        ));

        let expected_commitment = commitment.clone();
        let draft = build_proof_package_draft(ProofContext {
            sender: IssuerUser {
                id: 1,
                wallet: sender_hex.clone(),
                jurisdiction: "US".into(),
                jurisdiction_code: 840,
                credential_expiry: 4_102_444_800,
                sanctions_clear: true,
                enabled: true,
                provider: Some("mock".into()),
                provider_ref: Some("ok".into()),
                metadata: json!({ "corridor_eligibility": [1] }),
            },
            sender_credential: ActivatedCredential {
                id: 1,
                user_id: 1,
                wallet: sender_hex.clone(),
                credential_commitment: commitment.clone(),
                jurisdiction_code: 840,
                credential_expiry: 4_102_444_800,
                enabled: true,
                activated_at: now_unix(),
            },
            corridor: CorridorRecord {
                id: 1,
                name: "US -> IN".into(),
                source_country: "US".into(),
                dest_country: "IN".into(),
                enabled: true,
                asset_hex: asset_hex.clone(),
                issuer_strkey: Some(issuer_strkey.clone()),
                travel_rule_threshold: "0".into(),
            },
            destination: CorridorDestinationRecord {
                id: 1,
                corridor_id: 1,
                address: recipient_hex.clone(),
                enabled: true,
                metadata: Value::Null,
            },
            users: vec![IssuerUser {
                id: 1,
                wallet: sender_hex.clone(),
                jurisdiction: "US".into(),
                jurisdiction_code: 840,
                credential_expiry: 4_102_444_800,
                sanctions_clear: true,
                enabled: true,
                provider: Some("mock".into()),
                provider_ref: Some("ok".into()),
                metadata: json!({}),
            }],
            credentials: vec![ActivatedCredential {
                id: 1,
                user_id: 1,
                wallet: sender_hex.clone(),
                credential_commitment: commitment,
                jurisdiction_code: 840,
                credential_expiry: 4_102_444_800,
                enabled: true,
                activated_at: now_unix(),
            }],
            destinations: vec![CorridorDestinationRecord {
                id: 1,
                corridor_id: 1,
                address: recipient_hex,
                enabled: true,
                metadata: Value::Null,
            }],
            amount: "25".into(),
            issuer_public_key: issuer_strkey,
        })
        .expect("draft");

        assert_eq!(
            draft.credential.credential_commitment.as_deref(),
            Some(expected_commitment.as_str())
        );
        assert_eq!(
            draft.public_inputs.get("nullifier").map(String::as_str),
            Some("")
        );
        assert!(draft.public_inputs.contains_key("issuer_lo"));
        assert!(draft.public_inputs.contains_key("issuer_hi"));
    }
}
