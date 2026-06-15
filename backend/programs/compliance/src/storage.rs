use soroban_sdk::{contracttype, Address, BytesN};

pub const EPOCH_LEN_SECS: u64 = 86_400;
pub const MAX_EPOCH_LAG: u64 = 1;
pub const MAX_ROOT_AGE_LEDGERS: u32 = 172_800;
pub const PUBLIC_INPUT_COUNT: u32 = 17;
pub const DEFAULT_TTL: u32 = 500_000;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IssuerRoots {
    pub merkle_root: BytesN<32>,
    pub sanctions_root: BytesN<32>,
    pub jurisdiction_root: BytesN<32>,
    pub updated_ledger: u32,
    pub enabled: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CorridorConfig {
    pub corridor_id: u32,
    pub corridor_config_hash: BytesN<32>,
    pub source_jurisdiction_root: BytesN<32>,
    pub dest_address_root: BytesN<32>,
    pub enabled: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub admin: Address,
    pub verifier: Address,
    pub expected_vk_hash: BytesN<32>,
    pub paused: bool,
    pub pending_admin: Option<Address>,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Config,
    Issuer(Address),
    Corridor(u32),
    Nullifier(BytesN<32>),
}
