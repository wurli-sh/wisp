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
pub const AUTH_DATA_NAME: &str = "amoeba auth";
const MOCK_MIN_AGE_YEARS: u32 = 18;
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
    pub name: String,
    pub country: String,
    pub dob: String,
    pub sanctions_clear: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MockKycSubmitStatus {
    Approved,
    Rejected,
    AlreadyApproved,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MockKycSubmitResponse {
    pub status: MockKycSubmitStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MockKycStatusResponse {
    pub wallet: String,
    pub kyc_status: MockKycLifecycleStatus,
    pub eligible_for_proof: bool,
    pub missing: Vec<MockKycMissing>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rejection_reason: Option<String>,
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

pub fn wallet_strkey_from_hex(wallet_hex: &str) -> Result<String, String> {
    let bytes = hex::decode(wallet_hex).map_err(|_| "invalid wallet hex".to_string())?;
    let payload: [u8; 32] = bytes
        .try_into()
        .map_err(|_| "invalid wallet hex length".to_string())?;
    Ok(StrKeyPublicKey(payload).to_string())
}

pub fn build_challenge(
    wallet_strkey: &str,
    _network_passphrase: &str,
) -> Result<(String, String, String, i64), String> {
    let _wallet_hex = validate_wallet_strkey(wallet_strkey)?;
    let pubkey = parse_strkey_pubkey(wallet_strkey)?;
    let nonce = random_nonce();
    let expires_at = now_unix() + CHALLENGE_TTL_SECS as i64;

    let data_name = string64(AUTH_DATA_NAME)?;
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
        seq_num: SequenceNumber(0),
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
    if data_name != AUTH_DATA_NAME {
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

pub fn evaluate_mock_kyc_form(
    country: &str,
    dob: &str,
    sanctions_clear: bool,
) -> Result<(), String> {
    if !sanctions_clear {
        return Err("sanctions declaration must be clear".into());
    }
    if !country.trim().eq_ignore_ascii_case(MOCK_JURISDICTION) {
        return Err(format!(
            "only {MOCK_JURISDICTION} is supported for demo mock KYC"
        ));
    }
    if age_from_dob(dob)? < MOCK_MIN_AGE_YEARS {
        return Err(format!("must be at least {MOCK_MIN_AGE_YEARS} years old"));
    }
    Ok(())
}

pub fn mock_credential_expiry() -> u64 {
    now_unix() as u64 + 31_536_000
}

pub fn mock_jurisdiction() -> (&'static str, u32) {
    (MOCK_JURISDICTION, MOCK_JURISDICTION_CODE)
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

fn age_from_dob(dob: &str) -> Result<u32, String> {
    let trimmed = dob.trim();
    let mut parts = trimmed.split('-');
    let year: i32 = parts
        .next()
        .ok_or_else(|| "invalid date of birth".to_string())?
        .parse()
        .map_err(|_| "invalid date of birth".to_string())?;
    let month: u32 = parts
        .next()
        .ok_or_else(|| "invalid date of birth".to_string())?
        .parse()
        .map_err(|_| "invalid date of birth".to_string())?;
    let day: u32 = parts
        .next()
        .ok_or_else(|| "invalid date of birth".to_string())?
        .parse()
        .map_err(|_| "invalid date of birth".to_string())?;
    if parts.next().is_some() {
        return Err("invalid date of birth".into());
    }

    let today = chrono_like_today();
    let mut age = today.year - year;
    if (today.month, today.day) < (month as i32, day as i32) {
        age -= 1;
    }
    if age < 0 {
        return Err("invalid date of birth".into());
    }
    Ok(age as u32)
}

struct Today {
    year: i32,
    month: i32,
    day: i32,
}

fn chrono_like_today() -> Today {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock before epoch");
    let days = now.as_secs() / 86_400;
    civil_from_days(days as i64)
}

// Howard Hinnant's algorithms (public domain) — UTC civil date from unix days.
fn civil_from_days(days: i64) -> Today {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = mp + if mp < 10 { 3 } else { -9 };
    let year = y + if m <= 2 { 1 } else { 0 };
    Today {
        year: year as i32,
        month: m as i32,
        day: d as i32,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn evaluate_form_rejects_non_us() {
        let err = evaluate_mock_kyc_form("MX", "1990-01-15", true).unwrap_err();
        assert!(err.contains("US"));
    }

    #[test]
    fn evaluate_form_rejects_underage() {
        let err = evaluate_mock_kyc_form("US", "2020-01-15", true).unwrap_err();
        assert!(err.contains("18"));
    }

    #[test]
    fn validate_wallet_rejects_garbage() {
        assert!(validate_wallet_strkey("not-a-wallet").is_err());
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
}
