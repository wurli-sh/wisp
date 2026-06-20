use std::time::{SystemTime, UNIX_EPOCH};

use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use stellar_strkey::ed25519::PublicKey as StrKeyPublicKey;
use stellar_xdr::curr::{
    DataValue, Limits, ManageDataOp, Memo, MuxedAccount, Operation, OperationBody, Preconditions,
    ReadXdr, SequenceNumber, String64, TimeBounds, TimePoint, Transaction, TransactionEnvelope,
    TransactionExt, TransactionV1Envelope, Uint256, VecM, WriteXdr,
};

use crate::trees::{payload_to_hex, strkey_to_payload};

pub const MOCK_CREDENTIAL_SECRET: &str = "424242";
pub const CHALLENGE_TTL_SECS: u64 = 300;
const MOCK_JURISDICTION: &str = "US";
const MOCK_JURISDICTION_CODE: u32 = 840;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MockKycChallengeRecord {
    pub id: String,
    pub wallet_hex: String,
    pub wallet_strkey: String,
    pub challenge_xdr: String,
    pub nonce: String,
    pub expires_at: i64,
    pub consumed_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MockKycChallengeRequest {
    pub wallet: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MockKycChallengeResponse {
    pub challenge_id: String,
    pub challenge_xdr: String,
    pub expires_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MockKycSubmitRequest {
    pub challenge_id: String,
    pub signed_challenge_xdr: String,
    #[serde(default)]
    pub corridor_id: Option<u32>,
    #[serde(default)]
    pub recipient: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MockKycSubmitStatus {
    Approved,
    Rejected,
    AlreadyApproved,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MockKycRootsStatus {
    Missing,
    Publishing,
    Active,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MockKycSubmitResponse {
    pub status: MockKycSubmitStatus,
    pub kyc_status: MockKycLifecycleStatus,
    pub eligible_for_proof: bool,
    pub missing: Vec<MockKycMissing>,
    pub roots_status: MockKycRootsStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub roots_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rejection_reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub publish_warning: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MockKycLifecycleStatus {
    None,
    Approved,
    Rejected,
    Revoked,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MockKycMissing {
    Kyc,
    Destination,
    RootsPublished,
    Corridor,
    SenderCorridor,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MockKycStatusResponse {
    pub wallet: String,
    pub kyc_status: MockKycLifecycleStatus,
    pub eligible_for_proof: bool,
    pub missing: Vec<MockKycMissing>,
    pub roots_status: MockKycRootsStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub roots_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rejection_reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub publish_warning: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MockKycResubmitAction {
    Revoked,
    AlreadyApproved,
    Continue,
}

/// Classifies an existing mock-KYC user row before applying a new submission.
pub fn classify_mock_kyc_resubmit(
    provider: Option<&str>,
    enabled: bool,
    sanctions_clear: bool,
    kyc_status: Option<&str>,
    has_active_credential: bool,
) -> MockKycResubmitAction {
    if provider != Some("mock") {
        return MockKycResubmitAction::Continue;
    }
    if !enabled {
        if kyc_status == Some("rejected") {
            return MockKycResubmitAction::Continue;
        }
        return MockKycResubmitAction::Revoked;
    }
    if sanctions_clear && has_active_credential {
        return MockKycResubmitAction::AlreadyApproved;
    }
    MockKycResubmitAction::Continue
}

pub fn validate_wallet_strkey(wallet: &str) -> Result<String, String> {
    let trimmed = wallet.trim();
    if trimmed.is_empty() {
        return Err("wallet is required".into());
    }
    StrKeyPublicKey::from_string(trimmed)
        .map_err(|_| "invalid stellar wallet address".to_string())?;
    let payload = strkey_to_payload(trimmed)?;
    Ok(payload_to_hex(&payload))
}

/// Accept 64-char hex or Stellar strkey; return lowercase wallet hex for DB lookup.
pub fn normalize_wallet_hex(wallet: &str) -> Result<String, String> {
    let trimmed = wallet.trim();
    if trimmed.len() == 64 && trimmed.chars().all(|c| c.is_ascii_hexdigit()) {
        return Ok(trimmed.to_lowercase());
    }
    validate_wallet_strkey(trimmed)
}

pub fn wallet_strkey_from_hex(wallet_hex: &str) -> Result<String, String> {
    let bytes = hex::decode(wallet_hex).map_err(|_| "invalid wallet hex".to_string())?;
    let payload: [u8; 32] = bytes
        .try_into()
        .map_err(|_| "invalid wallet hex length".to_string())?;
    Ok(StrKeyPublicKey(payload).to_string())
}

pub fn auth_data_name(web_auth_domain: &str) -> String {
    format!("{} auth", web_auth_domain.trim())
}

pub fn build_challenge(
    wallet_strkey: &str,
    _network_passphrase: &str,
    web_auth_domain: &str,
    seq_num: Option<i64>,
) -> Result<(String, String, String, i64), String> {
    let _wallet_hex = validate_wallet_strkey(wallet_strkey)?;
    let pubkey = parse_strkey_pubkey(wallet_strkey)?;
    let nonce = random_nonce();
    let expires_at = now_unix() + CHALLENGE_TTL_SECS as i64;
    let data_name = string64(&auth_data_name(web_auth_domain))?;

    let data_value = data_value_from_str(&nonce)?;

    let operation = Operation {
        source_account: None,
        body: OperationBody::ManageData(ManageDataOp {
            data_name,
            data_value: Some(data_value),
        }),
    };

    let transaction = Transaction {
        source_account: MuxedAccount::Ed25519(Uint256(pubkey)),
        fee: 100,
        seq_num: SequenceNumber(seq_num.unwrap_or(0)),
        cond: Preconditions::Time(TimeBounds {
            min_time: TimePoint(0),
            max_time: TimePoint(expires_at as u64),
        }),
        memo: Memo::None,
        operations: VecM::try_from(vec![operation]).map_err(|e| format!("operations: {e}"))?,
        ext: TransactionExt::V0,
    };

    let envelope = TransactionEnvelope::Tx(TransactionV1Envelope {
        tx: transaction,
        signatures: VecM::try_from(Vec::<stellar_xdr::curr::DecoratedSignature>::new())
            .map_err(|e| format!("signatures: {e}"))?,
    });

    let challenge_xdr = envelope
        .to_xdr_base64(Limits::none())
        .map_err(|e| format!("challenge xdr encode failed: {e}"))?;

    let challenge_id = uuid::Uuid::new_v4().to_string();
    Ok((challenge_id, challenge_xdr, nonce, expires_at))
}

pub fn verify_signed_challenge(
    signed_xdr: &str,
    expected_wallet_strkey: &str,
    expected_nonce: &str,
    network_passphrase: &str,
    web_auth_domain: &str,
    expires_at: i64,
) -> Result<(), String> {
    if now_unix() > expires_at {
        return Err("challenge expired".into());
    }

    let envelope = TransactionEnvelope::from_xdr_base64(signed_xdr.trim(), Limits::none())
        .map_err(|e| format!("invalid challenge xdr: {e}"))?;

    let (tx, signatures) = match envelope {
        TransactionEnvelope::Tx(v1) => (v1.tx, v1.signatures),
        _ => return Err("unsupported transaction envelope type".into()),
    };

    if signatures.is_empty() {
        return Err("missing signature".into());
    }

    let expected_pk = parse_strkey_pubkey(expected_wallet_strkey)?;
    let tx_pk = muxed_account_pubkey(&tx.source_account)?;
    if tx_pk != expected_pk {
        return Err("wallet mismatch".into());
    }

    let (data_name, nonce) = extract_manage_data_nonce(&tx)?;
    if data_name != auth_data_name(web_auth_domain) {
        return Err("invalid challenge operation name".into());
    }
    if nonce != expected_nonce {
        return Err("challenge nonce mismatch".into());
    }

    verify_time_bounds(&tx.cond, expires_at)?;

    let network_id = network_id_hash(network_passphrase);
    let tx_hash = tx
        .hash(network_id)
        .map_err(|e| format!("tx hash failed: {e}"))?;

    let verifying_key =
        VerifyingKey::from_bytes(&tx_pk).map_err(|_| "invalid source account key".to_string())?;

    for decorated in signatures.iter() {
        let sig_bytes: [u8; 64] = decorated
            .signature
            .0
            .as_slice()
            .try_into()
            .map_err(|_| "invalid signature length".to_string())?;
        let signature = Signature::from_bytes(&sig_bytes);
        verifying_key
            .verify(&tx_hash, &signature)
            .map_err(|_| "invalid signature".to_string())?;
        return Ok(());
    }

    Err("no valid signature".into())
}

pub fn signed_challenge_matches_stored(signed_xdr: &str, stored_xdr: &str) -> Result<(), String> {
    let signed_env = TransactionEnvelope::from_xdr_base64(signed_xdr.trim(), Limits::none())
        .map_err(|e| format!("invalid signed challenge xdr: {e}"))?;
    let stored_env = TransactionEnvelope::from_xdr_base64(stored_xdr.trim(), Limits::none())
        .map_err(|e| format!("invalid stored challenge xdr: {e}"))?;

    let (signed_tx, _) = match signed_env {
        TransactionEnvelope::Tx(v1) => (v1.tx, v1.signatures),
        _ => return Err("unsupported signed transaction envelope type".into()),
    };
    let (stored_tx, _) = match stored_env {
        TransactionEnvelope::Tx(v1) => (v1.tx, v1.signatures),
        _ => return Err("unsupported stored transaction envelope type".into()),
    };

    if transactions_match(&signed_tx, &stored_tx) {
        Ok(())
    } else {
        Err("signed transaction does not match issued challenge".into())
    }
}

fn transactions_match(a: &Transaction, b: &Transaction) -> bool {
    a.source_account == b.source_account
        && a.fee == b.fee
        && a.seq_num == b.seq_num
        && a.cond == b.cond
        && a.memo == b.memo
        && a.operations == b.operations
}

pub fn mock_credential_expiry() -> u64 {
    now_unix() as u64 + 31_536_000
}

pub fn mock_jurisdiction() -> (&'static str, u32) {
    (MOCK_JURISDICTION, MOCK_JURISDICTION_CODE)
}

pub async fn horizon_account_sequence(horizon_url: &str, account: &str) -> Option<i64> {
    let url = format!(
        "{}/accounts/{}",
        horizon_url.trim_end_matches('/'),
        account.trim()
    );
    let output = tokio::process::Command::new("curl")
        .args(["-sf", &url])
        .output()
        .await
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let json: serde_json::Value = serde_json::from_slice(&output.stdout).ok()?;
    json.get("sequence")?.as_str()?.parse().ok()
}

fn random_nonce() -> String {
    let mut bytes = [0u8; 32];
    rand::rng().fill_bytes(&mut bytes);
    hex::encode(bytes)
}

fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock before epoch")
        .as_secs() as i64
}

fn network_id_hash(network_passphrase: &str) -> [u8; 32] {
    Sha256::digest(network_passphrase.as_bytes()).into()
}

fn parse_strkey_pubkey(wallet_strkey: &str) -> Result<[u8; 32], String> {
    StrKeyPublicKey::from_string(wallet_strkey.trim())
        .map(|key| key.0)
        .map_err(|_| "invalid stellar wallet address".to_string())
}

fn muxed_account_pubkey(account: &MuxedAccount) -> Result<[u8; 32], String> {
    match account {
        MuxedAccount::Ed25519(key) => Ok(key.0),
        MuxedAccount::MuxedEd25519(_) => Err("muxed accounts are not supported".into()),
    }
}

fn extract_manage_data_nonce(tx: &Transaction) -> Result<(String, String), String> {
    if tx.operations.len() != 1 {
        return Err("challenge must contain exactly one operation".into());
    }
    let body = &tx.operations[0].body;
    let OperationBody::ManageData(op) = body else {
        return Err("challenge operation must be ManageData".into());
    };
    let data_name = String::from_utf8_lossy(op.data_name.as_slice()).to_string();
    let Some(data_value) = &op.data_value else {
        return Err("challenge data value missing".into());
    };
    let nonce = String::from_utf8_lossy(data_value.0.as_slice()).to_string();
    Ok((data_name, nonce))
}

fn verify_time_bounds(cond: &Preconditions, expires_at: i64) -> Result<(), String> {
    match cond {
        Preconditions::Time(bounds) => {
            if now_unix() > bounds.max_time.0 as i64 {
                return Err("challenge expired".into());
            }
            if bounds.max_time.0 as i64 > expires_at {
                return Err("challenge expiry mismatch".into());
            }
            Ok(())
        }
        _ => Err("challenge must include time bounds".into()),
    }
}

fn string64(value: &str) -> Result<String64, String> {
    String64::try_from(value.as_bytes().to_vec()).map_err(|e| format!("string64: {e}"))
}

fn data_value_from_str(value: &str) -> Result<DataValue, String> {
    DataValue::try_from(value.as_bytes().to_vec()).map_err(|e| format!("data value: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_wallet_rejects_garbage() {
        assert!(validate_wallet_strkey("not-a-wallet").is_err());
    }

    #[test]
    fn auth_data_name_uses_domain() {
        assert_eq!(auth_data_name("demo.wisp.dev"), "demo.wisp.dev auth");
    }

    #[test]
    fn classify_resubmit_already_approved_requires_credential() {
        assert_eq!(
            classify_mock_kyc_resubmit(Some("mock"), true, true, Some("approved"), true),
            MockKycResubmitAction::AlreadyApproved
        );
        assert_eq!(
            classify_mock_kyc_resubmit(Some("mock"), true, true, Some("approved"), false),
            MockKycResubmitAction::Continue
        );
    }

    #[test]
    fn classify_resubmit_revoked_blocks_reapproval() {
        assert_eq!(
            classify_mock_kyc_resubmit(Some("mock"), false, true, Some("approved"), false),
            MockKycResubmitAction::Revoked
        );
    }

    #[test]
    fn classify_resubmit_rejected_allows_retry() {
        assert_eq!(
            classify_mock_kyc_resubmit(Some("mock"), false, false, Some("rejected"), false),
            MockKycResubmitAction::Continue
        );
    }

    #[test]
    fn signed_challenge_rejects_mismatched_stored_xdr() {
        let wallet = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
        let network = "Test SDF Network ; September 2015";
        let (_, challenge_a, _, _) =
            build_challenge(wallet, network, "localhost", Some(1)).expect("challenge a");
        let (_, challenge_b, _, _) =
            build_challenge(wallet, network, "localhost", Some(2)).expect("challenge b");
        assert!(signed_challenge_matches_stored(&challenge_a, &challenge_b).is_err());
        assert!(signed_challenge_matches_stored(&challenge_a, &challenge_a).is_ok());
    }
}
