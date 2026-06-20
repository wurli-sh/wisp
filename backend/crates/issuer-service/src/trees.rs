use std::collections::{BTreeMap, BTreeSet};
use std::convert::TryFrom;
use std::time::{SystemTime, UNIX_EPOCH};

use wisp_crypto::{
    address_to_limbs, compute_corridor_config_hash, compute_nullifier, compute_zero_hashes,
    fr_to_canonical_decimal, hash2, mod_u128, mod_u64, poseidon2_hash1, poseidon2_hash2,
    sparse_sanctions_path, MERKLE_DEPTH,
};
use wisp_types::public_inputs_from_roots;
use wisp_types::{
    CorridorOption, Credential, DemoPackageMetadata, DemoTransferFixture, DemoTransferRequest,
    DemoUsersFixture, MerklePaths, ProofPackage, Roots, TransferParams, WitnessPrivate,
    EPOCH_LEN_SECS,
};
use ark_bn254::Fr;
use rand::random;
use serde_json::{json, Value};

use crate::mock_kyc::normalize_wallet_hex;
use crate::state::{CorridorDestinationRecord, CorridorRecord, IssuerCredentialRecord, IssuerUser};

#[derive(Debug)]
pub struct NormalizedProviderEvent {
    pub provider: String,
    pub provider_ref: String,
    pub wallet: String,
    pub jurisdiction: String,
    pub jurisdiction_code: u32,
    pub credential_expiry: u64,
    pub sanctions_clear: bool,
    pub enabled: bool,
    pub credential_secret: String,
    pub metadata: Value,
}

pub fn hex_to_bytes(hex: &str) -> Vec<u8> {
    (0..hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).expect("hex"))
        .collect()
}

pub fn strkey_to_payload(strkey: &str) -> Result<[u8; 32], String> {
    const ALPHABET: &str = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    let mut bits = 0u32;
    let mut value = 0u32;
    let mut bytes = Vec::new();

    for ch in strkey.chars().filter(|c| !c.is_ascii_whitespace()) {
        let upper = ch.to_ascii_uppercase();
        let Some(idx) = ALPHABET.find(upper) else {
            return Err(format!("invalid strkey character: {ch}"));
        };
        value = (value << 5) | idx as u32;
        bits += 5;
        while bits >= 8 {
            bits -= 8;
            bytes.push(((value >> bits) & 0xff) as u8);
        }
    }

    if bytes.len() < 35 {
        return Err("strkey payload too short".into());
    }

    let payload = &bytes[1..33];
    payload
        .try_into()
        .map_err(|_| "invalid strkey payload width".to_string())
}

pub fn payload_to_hex(payload: &[u8; 32]) -> String {
    payload.iter().map(|b| format!("{b:02x}")).collect()
}

pub fn current_epoch() -> u64 {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time before unix epoch")
        .as_secs();
    now / EPOCH_LEN_SECS
}

fn country_code(users: &DemoUsersFixture, country: &str) -> Result<u32, String> {
    users
        .users
        .iter()
        .find(|u| u.jurisdiction.eq_ignore_ascii_case(country))
        .map(|u| u.jurisdiction_code)
        .ok_or_else(|| format!("unsupported source country: {country}"))
}

pub fn corridor_options(users: &DemoUsersFixture) -> Vec<CorridorOption> {
    users
        .corridors
        .iter()
        .filter_map(|c| {
            let normalized = c.name.replace('→', "-");
            let mut parts = normalized.split('-').map(str::trim);
            let source_country = parts.next()?.to_string();
            let dest_country = parts.next()?.to_string();
            Some(CorridorOption {
                id: c.id,
                name: c.name.clone(),
                source_country,
                dest_country,
                enabled: c.enabled,
            })
        })
        .collect()
}

pub fn build_dynamic_demo_fixture(
    req: &DemoTransferRequest,
    users: &DemoUsersFixture,
    template: &DemoTransferFixture,
) -> Result<DemoTransferFixture, String> {
    let sender = strkey_to_payload(&req.sender_strkey)?;
    let recipient = strkey_to_payload(&req.recipient_strkey)?;

    let corridor = corridor_options(users)
        .into_iter()
        .find(|c| c.id == req.corridor_id && c.enabled)
        .ok_or_else(|| format!("unknown enabled corridor id: {}", req.corridor_id))?;

    if !corridor
        .source_country
        .eq_ignore_ascii_case(&req.source_country)
    {
        return Err(format!(
            "source country {} does not match corridor {}",
            req.source_country, corridor.name
        ));
    }
    if !corridor
        .dest_country
        .eq_ignore_ascii_case(&req.dest_country)
    {
        return Err(format!(
            "destination country {} does not match corridor {}",
            req.dest_country, corridor.name
        ));
    }

    let amount = req.amount.trim();
    let parsed_amount: i128 = amount
        .parse()
        .map_err(|_| format!("invalid amount: {}", req.amount))?;
    if parsed_amount <= 0 {
        return Err("amount must be greater than zero".into());
    }

    let epoch = current_epoch();
    let jurisdiction_code = country_code(users, &req.source_country)?;

    Ok(DemoTransferFixture {
        demo_only: true,
        credential_secret: template.credential_secret.clone(),
        transfer_nonce: random::<u128>().to_string(),
        corridor_id: req.corridor_id,
        sender_hex: payload_to_hex(&sender),
        recipient_hex: payload_to_hex(&recipient),
        asset_hex: template.asset_hex.clone(),
        amount: parsed_amount.to_string(),
        epoch: epoch.to_string(),
        jurisdiction: jurisdiction_code.to_string(),
        credential_expiry: template.credential_expiry.clone(),
        sender_strkey: Some(req.sender_strkey.clone()),
        recipient_strkey: Some(req.recipient_strkey.clone()),
        asset_strkey: template.asset_strkey.clone(),
        issuer_strkey: template.issuer_strkey.clone(),
        source_country: Some(corridor.source_country),
        dest_country: Some(corridor.dest_country),
    })
}

pub fn normalize_provider_payload(
    provider: &str,
    event_key: &str,
    payload: &Value,
) -> Result<NormalizedProviderEvent, String> {
    let wallet = normalize_wallet_hex(
        payload
        .get("wallet")
        .or_else(|| payload.get("wallet_hex"))
        .and_then(Value::as_str)
        .ok_or_else(|| "provider payload missing wallet".to_string())?,
    )?;
    let jurisdiction = payload
        .get("jurisdiction")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "provider payload missing jurisdiction".to_string())?
        .to_string();
    let jurisdiction_code = payload
        .get("jurisdiction_code")
        .and_then(Value::as_u64)
        .map(|value| value as u32)
        .ok_or_else(|| "provider payload missing jurisdiction_code".to_string())?;
    let credential_expiry = payload
        .get("credential_expiry")
        .and_then(Value::as_u64)
        .ok_or_else(|| "provider payload missing credential_expiry".to_string())?;
    let sanctions_clear = payload
        .get("sanctions_clear")
        .and_then(Value::as_bool)
        .ok_or_else(|| "provider payload missing sanctions_clear".to_string())?;
    let enabled = payload
        .get("enabled")
        .and_then(Value::as_bool)
        .ok_or_else(|| "provider payload missing enabled".to_string())?;
    let credential_secret = payload
        .get("credential_secret")
        .and_then(|value| match value {
            Value::String(text) => Some(text.clone()),
            Value::Number(num) => Some(num.to_string()),
            _ => None,
        })
        .ok_or_else(|| "provider payload missing credential_secret".to_string())?;
    let provider_ref = payload
        .get("provider_ref")
        .or_else(|| payload.get("id"))
        .and_then(Value::as_str)
        .unwrap_or(event_key)
        .to_string();
    let corridor_eligibility = payload
        .get("corridor_eligibility")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    Ok(NormalizedProviderEvent {
        provider: provider.to_string(),
        provider_ref,
        wallet,
        jurisdiction,
        jurisdiction_code,
        credential_expiry,
        sanctions_clear,
        enabled,
        credential_secret,
        metadata: json!({ "corridor_eligibility": corridor_eligibility, "raw": payload }),
    })
}

pub fn build_canonical_proof_package(
    sender: &IssuerUser,
    credential: &IssuerCredentialRecord,
    corridor: &CorridorRecord,
    destination: &CorridorDestinationRecord,
    users: &[IssuerUser],
    destinations: &[CorridorDestinationRecord],
    amount: String,
) -> Result<ProofPackage, String> {
    let sender_bytes = hex_to_bytes(&sender.wallet);
    let recipient_bytes = hex_to_bytes(&destination.address);
    let asset_bytes = hex_to_bytes(&corridor.asset_hex);

    let sender_limbs = address_to_limbs(&sender_bytes);
    let recipient_limbs = address_to_limbs(&recipient_bytes);
    let asset_limbs = address_to_limbs(&asset_bytes);

    let sender_leaf = poseidon2_hash2(sender_limbs.lo, sender_limbs.hi);
    let active_users: Vec<_> = users.iter().filter(|user| user.enabled).cloned().collect();
    let mut membership_leaves = active_users
        .iter()
        .map(|user| {
            let limbs = address_to_limbs(&hex_to_bytes(&user.wallet));
            (user.wallet.clone(), poseidon2_hash2(limbs.lo, limbs.hi))
        })
        .collect::<Vec<_>>();
    membership_leaves.sort_by(|a, b| a.0.cmp(&b.0));
    let sender_index = membership_leaves
        .iter()
        .position(|(wallet, _)| wallet == &sender.wallet)
        .ok_or_else(|| "sender missing from membership set".to_string())?;
    let membership_tree = build_merkle_tree(
        &membership_leaves
            .iter()
            .map(|(_, leaf)| *leaf)
            .collect::<Vec<_>>(),
        sender_index,
    );
    debug_assert_eq!(membership_leaves[sender_index].1, sender_leaf);

    let jurisdiction_codes = active_users
        .iter()
        .map(|user| user.jurisdiction_code)
        .collect::<BTreeSet<_>>();
    let jurisdiction_order = jurisdiction_codes.into_iter().collect::<Vec<_>>();
    let jurisdiction_index = jurisdiction_order
        .iter()
        .position(|code| *code == sender.jurisdiction_code)
        .ok_or_else(|| "sender jurisdiction missing from approved set".to_string())?;
    let jurisdiction_leaves = jurisdiction_order
        .iter()
        .map(|code| poseidon2_hash1(mod_u128(*code as u128)))
        .collect::<Vec<_>>();
    let jurisdiction_tree = build_merkle_tree(&jurisdiction_leaves, jurisdiction_index);

    let source_jurisdiction_leaf = poseidon2_hash1(mod_u128(default_jurisdiction_code(
        &corridor.source_country,
    ) as u128));
    let source_tree = build_merkle_tree(&[source_jurisdiction_leaf], 0);

    let destination_order = destinations
        .iter()
        .filter(|item| item.enabled)
        .map(|item| item.address.clone())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    let destination_index = destination_order
        .iter()
        .position(|address| address == &destination.address)
        .ok_or_else(|| "destination missing from approved registry".to_string())?;
    let destination_leaves = destination_order
        .iter()
        .map(|address| {
            let limbs = address_to_limbs(&hex_to_bytes(address));
            poseidon2_hash2(limbs.lo, limbs.hi)
        })
        .collect::<Vec<_>>();
    let destination_tree = build_merkle_tree(&destination_leaves, destination_index);

    let sanctions = sparse_sanctions_path(sender_limbs.lo, sender_limbs.hi, MERKLE_DEPTH);
    let epoch = current_epoch();
    let parsed_amount: i128 = amount
        .parse()
        .map_err(|_| format!("invalid amount: {amount}"))?;
    if parsed_amount <= 0 {
        return Err("amount must be greater than zero".into());
    }
    let credential_secret: u128 = credential
        .credential_secret
        .parse()
        .map_err(|_| "invalid credential secret".to_string())?;
    let transfer_nonce = random::<u128>();
    let nullifier = compute_nullifier(
        mod_u128(credential_secret),
        sender_limbs.lo,
        sender_limbs.hi,
        asset_limbs.lo,
        asset_limbs.hi,
        mod_u64(epoch),
        recipient_limbs.lo,
        recipient_limbs.hi,
        mod_u64(u64::try_from(parsed_amount).map_err(|_| "amount overflow".to_string())?),
        mod_u64(corridor.id as u64),
        mod_u128(transfer_nonce),
    );

    let corridor_config_hash = compute_corridor_config_hash(
        mod_u64(corridor.id as u64),
        source_tree.root,
        destination_tree.root,
        mod_u64(u64::from(corridor.enabled)),
        mod_u64(
            corridor
                .travel_rule_threshold
                .parse::<u64>()
                .unwrap_or_default(),
        ),
    );

    let public_input_values = public_inputs_from_roots(
        membership_tree.root,
        nullifier,
        asset_limbs.lo,
        asset_limbs.hi,
        sender_limbs.lo,
        sender_limbs.hi,
        epoch,
        recipient_limbs.lo,
        recipient_limbs.hi,
        parsed_amount,
        sanctions.root,
        jurisdiction_tree.root,
        epoch * EPOCH_LEN_SECS,
        corridor.id,
        corridor_config_hash,
        source_tree.root,
        destination_tree.root,
    );
    let public_inputs = wisp_types::PUBLIC_INPUT_FIELDS
        .iter()
        .zip(public_input_values.iter())
        .map(|(name, value)| (name.to_string(), value.clone()))
        .collect();

    Ok(ProofPackage {
        schema_version: 1,
        credential: Credential {
            wallet: sender.wallet.clone(),
            jurisdiction: sender.jurisdiction.clone(),
            credential_expiry: sender.credential_expiry,
            sanctions_clear: sender.sanctions_clear,
            corridor_eligibility: sender
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
            credential_commitment: None,
        },
        transfer: TransferParams {
            asset: corridor.asset_hex.clone(),
            sender: sender.wallet.clone(),
            recipient: destination.address.clone(),
            amount,
            corridor_id: corridor.id,
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
            sender_strkey: crate::mock_kyc::wallet_strkey_from_hex(&sender.wallet).ok(),
            recipient_strkey: crate::mock_kyc::wallet_strkey_from_hex(&destination.address).ok(),
            asset_strkey: None,
            issuer_strkey: corridor.issuer_strkey.clone(),
            source_country: Some(corridor.source_country.clone()),
            dest_country: Some(corridor.dest_country.clone()),
        }),
        witness_private: Some(WitnessPrivate {
            demo_unsafe: false,
            credential_secret: credential.credential_secret.clone(),
            transfer_nonce: transfer_nonce.to_string(),
            jurisdiction: sender.jurisdiction_code.to_string(),
            credential_expiry: sender.credential_expiry.to_string(),
            sanctions_leaf_value: "0".into(),
        }),
        public_inputs: Some(public_inputs),
    })
}

struct MerkleTreeResult {
    root: Fr,
    path: Vec<String>,
    path_indices: Vec<u8>,
}

fn build_merkle_tree(leaves: &[Fr], target_index: usize) -> MerkleTreeResult {
    let zeros = compute_zero_hashes(MERKLE_DEPTH);
    let mut level = if leaves.is_empty() {
        vec![zeros[0]]
    } else {
        leaves.to_vec()
    };
    let mut idx = target_index.min(level.len().saturating_sub(1));
    let mut path = Vec::with_capacity(MERKLE_DEPTH);
    let mut path_indices = Vec::with_capacity(MERKLE_DEPTH);

    for depth in 0..MERKLE_DEPTH {
        let sibling = if idx % 2 == 0 {
            level.get(idx + 1).copied().unwrap_or(zeros[depth])
        } else {
            level[idx - 1]
        };
        path.push(fr_to_canonical_decimal(sibling));
        path_indices.push((idx & 1) as u8);

        let mut next = Vec::with_capacity(level.len().div_ceil(2));
        for pair in level.chunks(2) {
            let left = pair[0];
            let right = if pair.len() == 2 {
                pair[1]
            } else {
                zeros[depth]
            };
            next.push(hash2(left, right));
        }
        level = next;
        idx >>= 1;
    }

    MerkleTreeResult {
        root: level[0],
        path,
        path_indices,
    }
}

fn default_jurisdiction_code(country: &str) -> u32 {
    let table = BTreeMap::from([
        ("US", 840u32),
        ("MX", 484u32),
        ("GB", 826u32),
        ("CA", 124u32),
        ("SG", 702u32),
    ]);
    table
        .get(&country.to_ascii_uppercase().as_str())
        .copied()
        .unwrap_or(840)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn normalize_provider_payload_requires_approval_fields() {
        let err = normalize_provider_payload(
            "persona",
            "evt_1",
            &json!({
                "wallet": "00112233445566778899aabbccddeeff1032547698badcfeefcdab8967452301"
            }),
        )
        .expect_err("payload without approval fields must fail");
        assert!(err.contains("missing jurisdiction"));
    }

    #[test]
    fn normalize_provider_payload_normalizes_wallet_hex() {
        let wallet = crate::mock_kyc::wallet_strkey_from_hex(
            "00112233445566778899aabbccddeeff1032547698badcfeefcdab8967452301",
        )
        .expect("wallet strkey");
        let event = normalize_provider_payload(
            "persona",
            "evt_1",
            &json!({
                "wallet": wallet,
                "jurisdiction": "US",
                "jurisdiction_code": 840,
                "credential_expiry": 2_000_000_000u64,
                "sanctions_clear": true,
                "enabled": true,
                "credential_secret": "424242"
            }),
        )
        .expect("normalized payload");
        assert_eq!(
            event.wallet,
            "00112233445566778899aabbccddeeff1032547698badcfeefcdab8967452301"
        );
    }
}
