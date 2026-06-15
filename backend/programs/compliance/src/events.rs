use soroban_sdk::{contractevent, contracttype, Address, BytesN};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProofSettledData {
    pub issuer: Address,
    pub nullifier: BytesN<32>,
    pub corridor_id: u32,
    pub asset: Address,
    pub sender: Address,
    pub recipient: Address,
    pub amount: i128,
    pub epoch: u64,
    pub merkle_root: BytesN<32>,
    pub sanctions_root: BytesN<32>,
    pub jurisdiction_root: BytesN<32>,
    pub corridor_config_hash: BytesN<32>,
    pub source_jurisdiction_root: BytesN<32>,
    pub dest_address_root: BytesN<32>,
    pub verifier: Address,
    pub vk_hash: BytesN<32>,
}

#[contractevent(topics = ["settled"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProofSettled {
    pub data: ProofSettledData,
}

#[contractevent(topics = ["paused"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PauseChanged {
    pub paused: bool,
    pub admin: Address,
}

#[contractevent(topics = ["admin", "proposed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminProposed {
    pub current_admin: Address,
    pub pending_admin: Address,
}

#[contractevent(topics = ["admin", "accepted"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminAccepted {
    pub old_admin: Address,
    pub new_admin: Address,
}

#[contractevent(topics = ["verifier", "changed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VerifierChanged {
    pub old_verifier: Address,
    pub new_verifier: Address,
    pub expected_vk_hash: BytesN<32>,
}

#[contractevent(topics = ["issuer", "registered"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IssuerRegistered {
    pub issuer: Address,
    pub merkle_root: BytesN<32>,
    pub sanctions_root: BytesN<32>,
    pub jurisdiction_root: BytesN<32>,
}

#[contractevent(topics = ["issuer", "root"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IssuerRootUpdated {
    pub issuer: Address,
    pub merkle_root: BytesN<32>,
    pub sanctions_root: BytesN<32>,
    pub jurisdiction_root: BytesN<32>,
}

#[contractevent(topics = ["issuer", "enabled"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IssuerEnabledChanged {
    pub issuer: Address,
    pub enabled: bool,
}

#[contractevent(topics = ["corridor", "registered"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CorridorRegistered {
    pub corridor_id: u32,
    pub corridor_config_hash: BytesN<32>,
    pub source_jurisdiction_root: BytesN<32>,
    pub dest_address_root: BytesN<32>,
}

#[contractevent(topics = ["corridor", "updated"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CorridorUpdated {
    pub corridor_id: u32,
    pub corridor_config_hash: BytesN<32>,
    pub source_jurisdiction_root: BytesN<32>,
    pub dest_address_root: BytesN<32>,
    pub enabled: bool,
}
