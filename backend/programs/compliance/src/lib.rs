#![no_std]

mod error;
pub mod events;
pub mod public_inputs;
mod storage;

use error::ComplianceError;
use events::{
    AdminAccepted, AdminProposed, CorridorRegistered, CorridorUpdated, IssuerEnabledChanged,
    IssuerRegistered, IssuerRootUpdated, PauseChanged, ProofSettled, ProofSettledData,
    VerifierChanged,
};
use public_inputs::{public_inputs_match, rebuild_expected_public_inputs};
use soroban_sdk::{
    contract, contractclient, contractimpl, contracttype,
    crypto::bn254::{Bn254G1Affine, Bn254G2Affine, Fr},
    token, Address, BytesN, Env, Vec,
};
use storage::{
    Config, CorridorConfig, DataKey, IssuerRoots, DEFAULT_TTL, EPOCH_LEN_SECS, MAX_EPOCH_LAG,
    MAX_ROOT_AGE_LEDGERS, PUBLIC_INPUT_COUNT,
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
                verifier,
                expected_vk_hash,
                paused: false,
                pending_admin: None,
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
        let config = Self::config(&env)?;
        config.admin.require_auth();
        let old_verifier = config.verifier.clone();
        env.storage().instance().set(
            &DataKey::Config,
            &Config {
                admin: config.admin,
                verifier: verifier.clone(),
                expected_vk_hash: expected_vk_hash.clone(),
                paused: config.paused,
                pending_admin: config.pending_admin,
            },
        );
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
        merkle_root: BytesN<32>,
        sanctions_root: BytesN<32>,
        jurisdiction_root: BytesN<32>,
    ) -> Result<(), ComplianceError> {
        let config = Self::config(&env)?;
        config.admin.require_auth();
        let key = DataKey::Issuer(issuer.clone());
        env.storage().persistent().set(
            &key,
            &IssuerRoots {
                merkle_root: merkle_root.clone(),
                sanctions_root: sanctions_root.clone(),
                jurisdiction_root: jurisdiction_root.clone(),
                updated_ledger: env.ledger().sequence(),
                enabled: true,
            },
        );
        env.storage()
            .persistent()
            .extend_ttl(&key, DEFAULT_TTL, DEFAULT_TTL);
        IssuerRegistered {
            issuer,
            merkle_root,
            sanctions_root,
            jurisdiction_root,
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
        auth: Address,
    ) -> Result<(), ComplianceError> {
        let config = Self::config(&env)?;
        Self::require_issuer_or_admin(&auth, &issuer, &config.admin)?;
        let mut roots = Self::issuer(&env, &issuer)?;
        roots.merkle_root = merkle_root;
        roots.sanctions_root = sanctions_root;
        roots.jurisdiction_root = jurisdiction_root;
        roots.updated_ledger = env.ledger().sequence();
        let key = DataKey::Issuer(issuer.clone());
        env.storage().persistent().set(&key, &roots);
        env.storage()
            .persistent()
            .extend_ttl(&key, DEFAULT_TTL, DEFAULT_TTL);
        IssuerRootUpdated {
            issuer,
            merkle_root: roots.merkle_root,
            sanctions_root: roots.sanctions_root,
            jurisdiction_root: roots.jurisdiction_root,
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
        let mut roots = Self::issuer(&env, &issuer)?;
        roots.enabled = enabled;
        let key = DataKey::Issuer(issuer.clone());
        env.storage().persistent().set(&key, &roots);
        env.storage()
            .persistent()
            .extend_ttl(&key, DEFAULT_TTL, DEFAULT_TTL);
        IssuerEnabledChanged { issuer, enabled }.publish(&env);
        Ok(())
    }

    pub fn register_corridor(
        env: Env,
        corridor_id: u32,
        source_jurisdiction_root: BytesN<32>,
        dest_address_root: BytesN<32>,
        corridor_config_hash: BytesN<32>,
    ) -> Result<(), ComplianceError> {
        let config = Self::config(&env)?;
        config.admin.require_auth();
        let key = DataKey::Corridor(corridor_id);
        env.storage().persistent().set(
            &key,
            &CorridorConfig {
                corridor_id,
                corridor_config_hash: corridor_config_hash.clone(),
                source_jurisdiction_root: source_jurisdiction_root.clone(),
                dest_address_root: dest_address_root.clone(),
                enabled: true,
            },
        );
        env.storage()
            .persistent()
            .extend_ttl(&key, DEFAULT_TTL, DEFAULT_TTL);
        CorridorRegistered {
            corridor_id,
            corridor_config_hash,
            source_jurisdiction_root,
            dest_address_root,
        }
        .publish(&env);
        Ok(())
    }

    pub fn update_corridor(
        env: Env,
        corridor_id: u32,
        source_jurisdiction_root: BytesN<32>,
        dest_address_root: BytesN<32>,
        corridor_config_hash: BytesN<32>,
        enabled: bool,
    ) -> Result<(), ComplianceError> {
        let config = Self::config(&env)?;
        config.admin.require_auth();
        let key = DataKey::Corridor(corridor_id);
        env.storage().persistent().set(
            &key,
            &CorridorConfig {
                corridor_id,
                corridor_config_hash: corridor_config_hash.clone(),
                source_jurisdiction_root: source_jurisdiction_root.clone(),
                dest_address_root: dest_address_root.clone(),
                enabled,
            },
        );
        env.storage()
            .persistent()
            .extend_ttl(&key, DEFAULT_TTL, DEFAULT_TTL);
        CorridorUpdated {
            corridor_id,
            corridor_config_hash,
            source_jurisdiction_root,
            dest_address_root,
            enabled,
        }
        .publish(&env);
        Ok(())
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
        let issuer_roots = Self::issuer(&env, &args.issuer)?;
        if !issuer_roots.enabled {
            return Err(ComplianceError::IssuerDisabled);
        }

        let corridor = Self::corridor(&env, args.corridor_id)?;
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

        env.storage()
            .persistent()
            .set(&DataKey::Nullifier(args.nullifier.clone()), &true);
        env.storage().persistent().extend_ttl(
            &DataKey::Nullifier(args.nullifier.clone()),
            DEFAULT_TTL,
            DEFAULT_TTL,
        );

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
        token.transfer(&args.sender, &args.recipient, &args.amount);

        Ok(())
    }

    fn config(env: &Env) -> Result<Config, ComplianceError> {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(ComplianceError::NotInitialized)
    }

    fn issuer(env: &Env, issuer: &Address) -> Result<IssuerRoots, ComplianceError> {
        env.storage()
            .persistent()
            .get(&DataKey::Issuer(issuer.clone()))
            .ok_or(ComplianceError::UnknownIssuer)
    }

    fn corridor(env: &Env, corridor_id: u32) -> Result<CorridorConfig, ComplianceError> {
        env.storage()
            .persistent()
            .get(&DataKey::Corridor(corridor_id))
            .ok_or(ComplianceError::UnknownCorridor)
    }

    fn require_issuer_or_admin(
        auth: &Address,
        issuer: &Address,
        admin: &Address,
    ) -> Result<(), ComplianceError> {
        auth.require_auth();
        if auth != issuer && auth != admin {
            return Err(ComplianceError::Unauthorized);
        }
        Ok(())
    }
}

#[cfg(test)]
mod test;
