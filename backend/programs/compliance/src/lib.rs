#![no_std]

mod error;
pub mod events;
pub mod public_inputs;
mod storage;

use error::ComplianceError;
use events::{
    AdminAccepted, AdminProposed, IssuerCorridorRegistered, IssuerCorridorUpdated,
    IssuerEnabledChanged, IssuerMetadataUpdated, IssuerRegistered, IssuerRootUpdated,
    PauseChanged, ProofSettled, ProofSettledData, VerifierChanged,
};
use public_inputs::{public_inputs_match, rebuild_expected_public_inputs};
use soroban_sdk::{
    contract, contractclient, contractimpl, contracttype,
    crypto::bn254::{Bn254G1Affine, Bn254G2Affine, Fr},
    token, Address, BytesN, Env, String, Vec,
};
use storage::{
    Config, CorridorConfig, DataKey, IssuerPage, IssuerRecord, IssuerRoots, DEFAULT_TTL,
    EPOCH_LEN_SECS, MAX_EPOCH_LAG, MAX_ISSUER_PAGE_SIZE, MAX_ROOT_AGE_LEDGERS, PUBLIC_INPUT_COUNT,
};

#[derive(Clone)]
#[contracttype]
pub struct Proof {
    pub a: Bn254G1Affine,
    pub b: Bn254G2Affine,
    pub c: Bn254G1Affine,
}

#[contractclient(name = "Groth16VerifierClient")]
pub trait Groth16VerifierInterface {
    fn verify_proof(env: Env, proof: Proof, pub_signals: Vec<Fr>) -> bool;
    fn vk_hash(env: Env) -> BytesN<32>;
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompliantTransferArgs {
    pub issuer: Address,
    pub asset: Address,
    pub sender: Address,
    pub recipient: Address,
    pub amount: i128,
    pub corridor_id: u32,
    pub epoch: u64,
    pub nullifier: BytesN<32>,
}

#[contract]
pub struct Compliance;

#[contractimpl]
impl Compliance {
    pub fn initialize(
        env: Env,
        admin: Address,
        treasury: Address,
        registration_token: Address,
        registration_fee: i128,
        verifier: Address,
        expected_vk_hash: BytesN<32>,
    ) -> Result<(), ComplianceError> {
        if env.storage().instance().has(&DataKey::Config) {
            return Err(ComplianceError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(
            &DataKey::Config,
            &Config {
                admin,
                treasury,
                registration_token,
                registration_fee,
                verifier,
                expected_vk_hash,
                paused: false,
                pending_admin: None,
                next_issuer_seq: 0,
            },
        );
        Ok(())
    }

    pub fn set_paused(env: Env, paused: bool) -> Result<(), ComplianceError> {
        let mut config = Self::config(&env)?;
        config.admin.require_auth();
        config.paused = paused;
        env.storage().instance().set(&DataKey::Config, &config);

        PauseChanged {
            paused,
            admin: config.admin,
        }
        .publish(&env);
        Ok(())
    }

    pub fn propose_admin(env: Env, new_admin: Address) -> Result<(), ComplianceError> {
        let mut config = Self::config(&env)?;
        config.admin.require_auth();
        let current_admin = config.admin.clone();
        config.pending_admin = Some(new_admin.clone());
        env.storage().instance().set(&DataKey::Config, &config);

        AdminProposed {
            current_admin,
            pending_admin: new_admin,
        }
        .publish(&env);
        Ok(())
    }

    pub fn accept_admin(env: Env) -> Result<(), ComplianceError> {
        let mut config = Self::config(&env)?;
        let new_admin = config
            .pending_admin
            .clone()
            .ok_or(ComplianceError::NoPendingAdmin)?;
        new_admin.require_auth();
        let old_admin = config.admin;
        config.admin = new_admin.clone();
        config.pending_admin = None;
        env.storage().instance().set(&DataKey::Config, &config);

        AdminAccepted {
            old_admin,
            new_admin,
        }
        .publish(&env);
        Ok(())
    }

    pub fn set_verifier(
        env: Env,
        verifier: Address,
        expected_vk_hash: BytesN<32>,
    ) -> Result<(), ComplianceError> {
        let mut config = Self::config(&env)?;
        config.admin.require_auth();
        let old_verifier = config.verifier.clone();
        config.verifier = verifier.clone();
        config.expected_vk_hash = expected_vk_hash.clone();
        env.storage().instance().set(&DataKey::Config, &config);

        VerifierChanged {
            old_verifier,
            new_verifier: verifier,
            expected_vk_hash,
        }
        .publish(&env);
        Ok(())
    }

    pub fn register_issuer(
        env: Env,
        issuer: Address,
        metadata_uri: String,
    ) -> Result<(), ComplianceError> {
        let mut config = Self::config(&env)?;
        issuer.require_auth();
        if env
            .storage()
            .persistent()
            .has(&DataKey::Issuer(issuer.clone()))
        {
            return Err(ComplianceError::AlreadyRegistered);
        }

        let fee_token = token::Client::new(&env, &config.registration_token);
        fee_token.transfer(&issuer, &config.treasury, &config.registration_fee);

        let ledger = env.ledger().sequence();
        let seq = config.next_issuer_seq;
        config.next_issuer_seq = config.next_issuer_seq.saturating_add(1);
        env.storage().instance().set(&DataKey::Config, &config);

        let record = IssuerRecord {
            issuer: issuer.clone(),
            metadata_uri: metadata_uri.clone(),
            enabled: true,
            registered_at_ledger: ledger,
            updated_at_ledger: ledger,
            registration_seq: seq,
        };
        Self::set_persistent(&env, &DataKey::Issuer(issuer.clone()), &record);
        Self::set_persistent(&env, &DataKey::IssuerIndex(seq), &issuer);

        IssuerRegistered {
            issuer,
            metadata_uri,
            enabled: true,
            registered_at_ledger: ledger,
            updated_at_ledger: ledger,
            registration_seq: seq,
        }
        .publish(&env);
        Ok(())
    }

    pub fn update_issuer_metadata(
        env: Env,
        issuer: Address,
        metadata_uri: String,
    ) -> Result<(), ComplianceError> {
        issuer.require_auth();
        let mut record = Self::issuer_record(&env, &issuer)?;
        let old_metadata_uri = record.metadata_uri.clone();
        let updated_at_ledger = env.ledger().sequence();
        record.metadata_uri = metadata_uri.clone();
        record.updated_at_ledger = updated_at_ledger;
        Self::set_persistent(&env, &DataKey::Issuer(issuer.clone()), &record);

        IssuerMetadataUpdated {
            issuer,
            old_metadata_uri,
            new_metadata_uri: metadata_uri,
            updated_at_ledger,
        }
        .publish(&env);
        Ok(())
    }

    pub fn update_issuer_root(
        env: Env,
        issuer: Address,
        merkle_root: BytesN<32>,
        sanctions_root: BytesN<32>,
        jurisdiction_root: BytesN<32>,
    ) -> Result<(), ComplianceError> {
        issuer.require_auth();
        let _ = Self::issuer_record(&env, &issuer)?;
        let updated_ledger = env.ledger().sequence();
        let roots = IssuerRoots {
            merkle_root: merkle_root.clone(),
            sanctions_root: sanctions_root.clone(),
            jurisdiction_root: jurisdiction_root.clone(),
            updated_ledger,
        };
        Self::set_persistent(&env, &DataKey::IssuerRoots(issuer.clone()), &roots);
        IssuerRootUpdated {
            issuer,
            merkle_root,
            sanctions_root,
            jurisdiction_root,
            updated_ledger,
        }
        .publish(&env);
        Ok(())
    }

    pub fn set_issuer_enabled(
        env: Env,
        issuer: Address,
        enabled: bool,
    ) -> Result<(), ComplianceError> {
        let config = Self::config(&env)?;
        config.admin.require_auth();
        let mut record = Self::issuer_record(&env, &issuer)?;
        record.enabled = enabled;
        record.updated_at_ledger = env.ledger().sequence();
        Self::set_persistent(&env, &DataKey::Issuer(issuer.clone()), &record);
        IssuerEnabledChanged { issuer, enabled }.publish(&env);
        Ok(())
    }

    pub fn register_corridor(
        env: Env,
        issuer: Address,
        corridor_id: u32,
        source_jurisdiction_root: BytesN<32>,
        dest_address_root: BytesN<32>,
        corridor_config_hash: BytesN<32>,
    ) -> Result<(), ComplianceError> {
        issuer.require_auth();
        let _ = Self::issuer_record(&env, &issuer)?;
        let key = DataKey::Corridor(issuer.clone(), corridor_id);
        if env.storage().persistent().has(&key) {
            return Err(ComplianceError::CorridorAlreadyExists);
        }
        let updated_ledger = env.ledger().sequence();
        let corridor = CorridorConfig {
            issuer: issuer.clone(),
            corridor_id,
            corridor_config_hash: corridor_config_hash.clone(),
            source_jurisdiction_root: source_jurisdiction_root.clone(),
            dest_address_root: dest_address_root.clone(),
            enabled: true,
            updated_ledger,
        };
        Self::set_persistent(&env, &key, &corridor);
        IssuerCorridorRegistered {
            issuer,
            corridor_id,
            corridor_config_hash,
            source_jurisdiction_root,
            dest_address_root,
            enabled: true,
            updated_ledger,
        }
        .publish(&env);
        Ok(())
    }

    pub fn update_corridor(
        env: Env,
        issuer: Address,
        corridor_id: u32,
        source_jurisdiction_root: BytesN<32>,
        dest_address_root: BytesN<32>,
        corridor_config_hash: BytesN<32>,
        enabled: bool,
    ) -> Result<(), ComplianceError> {
        issuer.require_auth();
        let _ = Self::issuer_record(&env, &issuer)?;
        let key = DataKey::Corridor(issuer.clone(), corridor_id);
        if !env.storage().persistent().has(&key) {
            return Err(ComplianceError::UnknownCorridor);
        }
        let updated_ledger = env.ledger().sequence();
        let corridor = CorridorConfig {
            issuer: issuer.clone(),
            corridor_id,
            corridor_config_hash: corridor_config_hash.clone(),
            source_jurisdiction_root: source_jurisdiction_root.clone(),
            dest_address_root: dest_address_root.clone(),
            enabled,
            updated_ledger,
        };
        Self::set_persistent(&env, &key, &corridor);
        IssuerCorridorUpdated {
            issuer,
            corridor_id,
            corridor_config_hash,
            source_jurisdiction_root,
            dest_address_root,
            enabled,
            updated_ledger,
        }
        .publish(&env);
        Ok(())
    }

    pub fn get_issuer(env: Env, issuer: Address) -> Option<IssuerRecord> {
        Self::get_persistent(&env, &DataKey::Issuer(issuer))
    }

    pub fn get_issuer_roots(env: Env, issuer: Address) -> Option<IssuerRoots> {
        Self::get_persistent(&env, &DataKey::IssuerRoots(issuer))
    }

    pub fn get_corridor(env: Env, issuer: Address, corridor_id: u32) -> Option<CorridorConfig> {
        Self::get_persistent(&env, &DataKey::Corridor(issuer, corridor_id))
    }

    pub fn list_issuers(
        env: Env,
        cursor: Option<u32>,
        limit: u32,
    ) -> Result<IssuerPage, ComplianceError> {
        if limit == 0 || limit > MAX_ISSUER_PAGE_SIZE {
            return Err(ComplianceError::InvalidPageLimit);
        }
        let config = Self::config(&env)?;
        let start = cursor.unwrap_or(0);
        let end = core::cmp::min(start.saturating_add(limit), config.next_issuer_seq);
        let mut issuers = Vec::new(&env);
        let mut index = start;
        while index < end {
            if let Some(address) = Self::get_persistent::<Address>(&env, &DataKey::IssuerIndex(index))
            {
                if let Some(record) =
                    Self::get_persistent::<IssuerRecord>(&env, &DataKey::Issuer(address))
                {
                    issuers.push_back(record);
                }
            }
            index = index.saturating_add(1);
        }
        let next_cursor = if end < config.next_issuer_seq {
            Some(end)
        } else {
            None
        };
        Ok(IssuerPage {
            issuers,
            next_cursor,
        })
    }

    pub fn check_attestation(env: Env, nullifier: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Nullifier(nullifier))
    }

    pub fn compliant_transfer(
        env: Env,
        args: CompliantTransferArgs,
        proof: Proof,
        public_inputs: Vec<Fr>,
    ) -> Result<(), ComplianceError> {
        args.sender.require_auth();

        if args.amount <= 0 {
            return Err(ComplianceError::ZeroAmount);
        }
        if public_inputs.len() != PUBLIC_INPUT_COUNT {
            return Err(ComplianceError::InvalidPublicInputLength);
        }

        let config = Self::config(&env)?;
        if config.paused {
            return Err(ComplianceError::Paused);
        }

        let issuer_record = Self::issuer_record(&env, &args.issuer)?;
        if !issuer_record.enabled {
            return Err(ComplianceError::IssuerDisabled);
        }
        let issuer_roots = Self::issuer_roots(&env, &args.issuer)?;
        let corridor = Self::corridor(&env, &args.issuer, args.corridor_id)?;
        if !corridor.enabled {
            return Err(ComplianceError::CorridorDisabled);
        }

        let current_ledger = env.ledger().sequence();
        if current_ledger.saturating_sub(issuer_roots.updated_ledger) > MAX_ROOT_AGE_LEDGERS {
            return Err(ComplianceError::StaleIssuerRoot);
        }

        let current_epoch = env.ledger().timestamp() / EPOCH_LEN_SECS;
        if args.epoch > current_epoch {
            return Err(ComplianceError::FutureEpoch);
        }
        if current_epoch.saturating_sub(args.epoch) > MAX_EPOCH_LAG {
            return Err(ComplianceError::StaleEpoch);
        }

        if env
            .storage()
            .persistent()
            .has(&DataKey::Nullifier(args.nullifier.clone()))
        {
            return Err(ComplianceError::DuplicateNullifier);
        }

        let verifier_client = Groth16VerifierClient::new(&env, &config.verifier);
        let vk_hash = verifier_client.vk_hash();
        if vk_hash != config.expected_vk_hash {
            return Err(ComplianceError::WrongVkHash);
        }

        let expected = rebuild_expected_public_inputs(
            &env,
            &issuer_roots.merkle_root,
            &args.nullifier,
            &args.asset,
            &args.sender,
            &args.recipient,
            args.amount,
            &issuer_roots.sanctions_root,
            &issuer_roots.jurisdiction_root,
            args.epoch,
            args.corridor_id,
            &corridor.corridor_config_hash,
            &corridor.source_jurisdiction_root,
            &corridor.dest_address_root,
        );

        if !public_inputs_match(&expected, &public_inputs) {
            return Err(ComplianceError::PublicInputMismatch);
        }

        if !verifier_client.verify_proof(&proof, &public_inputs) {
            return Err(ComplianceError::InvalidProof);
        }

        Self::set_persistent(&env, &DataKey::Nullifier(args.nullifier.clone()), &true);

        ProofSettled {
            data: ProofSettledData {
                issuer: args.issuer.clone(),
                nullifier: args.nullifier.clone(),
                corridor_id: args.corridor_id,
                asset: args.asset.clone(),
                sender: args.sender.clone(),
                recipient: args.recipient.clone(),
                amount: args.amount,
                epoch: args.epoch,
                merkle_root: issuer_roots.merkle_root,
                sanctions_root: issuer_roots.sanctions_root,
                jurisdiction_root: issuer_roots.jurisdiction_root,
                corridor_config_hash: corridor.corridor_config_hash,
                source_jurisdiction_root: corridor.source_jurisdiction_root,
                dest_address_root: corridor.dest_address_root,
                verifier: config.verifier.clone(),
                vk_hash,
            },
        }
        .publish(&env);

        let token = token::Client::new(&env, &args.asset);
        token.transfer_from(
            &env.current_contract_address(),
            &args.sender,
            &args.recipient,
            &args.amount,
        );

        Ok(())
    }

    fn config(env: &Env) -> Result<Config, ComplianceError> {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(ComplianceError::NotInitialized)
    }

    fn issuer_record(env: &Env, issuer: &Address) -> Result<IssuerRecord, ComplianceError> {
        Self::get_persistent(env, &DataKey::Issuer(issuer.clone()))
            .ok_or(ComplianceError::UnknownIssuer)
    }

    fn issuer_roots(env: &Env, issuer: &Address) -> Result<IssuerRoots, ComplianceError> {
        Self::get_persistent(env, &DataKey::IssuerRoots(issuer.clone()))
            .ok_or(ComplianceError::MissingIssuerRoots)
    }

    fn corridor(
        env: &Env,
        issuer: &Address,
        corridor_id: u32,
    ) -> Result<CorridorConfig, ComplianceError> {
        Self::get_persistent(env, &DataKey::Corridor(issuer.clone(), corridor_id))
            .ok_or(ComplianceError::UnknownCorridor)
    }

    fn get_persistent<T: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + TryFromVal<Env, soroban_sdk::Val>>(
        env: &Env,
        key: &DataKey,
    ) -> Option<T> {
        env.storage().persistent().get(key)
    }

    fn set_persistent<T: soroban_sdk::IntoVal<Env, soroban_sdk::Val>>(
        env: &Env,
        key: &DataKey,
        value: &T,
    ) {
        env.storage().persistent().set(key, value);
        env.storage()
            .persistent()
            .extend_ttl(key, DEFAULT_TTL, DEFAULT_TTL);
    }
}

use soroban_sdk::TryFromVal;

#[cfg(test)]
mod test_sac;

mod test;
