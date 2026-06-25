use std::collections::{BTreeMap, BTreeSet};
use std::convert::TryFrom;
use std::time::{SystemTime, UNIX_EPOCH};

use ark_bn254::Fr;
use rand::random;
use serde_json::Value;
use stellar_strkey::ed25519::PublicKey as StrKeyPublicKey;
use wisp_crypto::{
    address_to_limbs, compute_corridor_config_hash, compute_nullifier, compute_zero_hashes,
    fr_to_canonical_decimal, hash2, mod_u128, mod_u64, poseidon2_hash1, poseidon2_hash2,
    sparse_sanctions_path, MERKLE_DEPTH,
};
use wisp_types::{
    public_inputs_from_roots, Credential, DemoPackageMetadata, MerklePaths, ProofPackage, Roots,
    TransferParams, WitnessPrivate, EPOCH_LEN_SECS,
};

use crate::model::*;
pub(crate) fn normalize_wallet_hex(wallet: &str) -> Result<String, String> {
    let trimmed = wallet.trim();
    if trimmed.len() == 64 && trimmed.chars().all(|c| c.is_ascii_hexdigit()) {
        return Ok(trimmed.to_lowercase());
    }
    let pubkey =
        StrKeyPublicKey::from_string(trimmed).map_err(|_| "invalid stellar wallet address")?;
    Ok(pubkey.0.iter().map(|b| format!("{b:02x}")).collect())
}

pub(crate) fn roots_match(snapshot: &RootSnapshotRecord, roots: &Roots) -> bool {
    snapshot.merkle_root == roots.merkle_root
        && snapshot.sanctions_root == roots.sanctions_root
        && snapshot.jurisdiction_root == roots.jurisdiction_root
        && snapshot.source_jurisdiction_root == roots.source_jurisdiction_root
        && snapshot.dest_address_root == roots.dest_address_root
        && snapshot.corridor_config_hash == roots.corridor_config_hash
}

fn hex_to_bytes(hex: &str) -> Vec<u8> {
    (0..hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).expect("hex"))
        .collect()
}

fn current_epoch() -> u64 {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time before unix epoch")
        .as_secs();
    now / EPOCH_LEN_SECS
}

fn wallet_strkey_from_hex(wallet_hex: &str) -> Result<String, String> {
    let bytes = hex_to_bytes(wallet_hex);
    let payload: [u8; 32] = bytes
        .try_into()
        .map_err(|_| "invalid wallet hex length".to_string())?;
    Ok(StrKeyPublicKey(payload).to_string())
}

pub fn build_canonical_proof_package(
    sender: &IssuerUser,
    credential: &IssuerCredentialRecord,
    corridor: &CorridorRecord,
    destination: &CorridorDestinationRecord,
    users: &[IssuerUser],
    destinations: &[CorridorDestinationRecord],
    amount: String,
    demo_overrides: Option<(u128, u64)>,
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
    let epoch = demo_overrides
        .map(|(_, epoch)| epoch)
        .unwrap_or_else(current_epoch);
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
    let transfer_nonce = demo_overrides
        .map(|(nonce, _)| nonce)
        .unwrap_or_else(random::<u128>);
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
            sender_strkey: wallet_strkey_from_hex(&sender.wallet).ok(),
            recipient_strkey: wallet_strkey_from_hex(&destination.address).ok(),
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

pub(crate) fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time before unix epoch")
        .as_secs() as i64
}
