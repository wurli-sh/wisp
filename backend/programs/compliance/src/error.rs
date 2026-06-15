use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ComplianceError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    UnknownIssuer = 4,
    IssuerDisabled = 5,
    UnknownCorridor = 6,
    CorridorDisabled = 7,
    StaleIssuerRoot = 8,
    DuplicateNullifier = 9,
    ZeroAmount = 10,
    WrongVkHash = 12,
    PublicInputMismatch = 13,
    InvalidProof = 14,
    InvalidPublicInputLength = 15,
    FutureEpoch = 16,
    StaleEpoch = 17,
    Paused = 18,
    NoPendingAdmin = 19,
}
