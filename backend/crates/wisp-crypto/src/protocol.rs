use ark_bn254::Fr;

use crate::field::{bytes16_to_fr, mod_fr, mod_u128};
use crate::poseidon2::{poseidon2_hash1, poseidon2_hash10, poseidon2_hash12};

pub const NULLIFIER_DOMAIN_TAG: u128 = 24_568_945_153_365_555;
pub const CREDENTIAL_DOMAIN_TAG: u128 = 24_568_945_153_365_555;
pub const CORRIDOR_DOMAIN_TAG: u128 = 0x574953505f5631;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AddressLimbs {
    pub lo: Fr,
    pub hi: Fr,
}

pub fn address_to_limbs(bytes: &[u8]) -> AddressLimbs {
    let hi = bytes16_to_fr(&bytes[..bytes.len().min(16)]);
    let lo = if bytes.len() > 16 {
        bytes16_to_fr(&bytes[16..])
    } else {
        mod_u128(0)
    };
    AddressLimbs { lo, hi }
}

pub fn compute_corridor_config_hash(
    corridor_id: Fr,
    source_jurisdiction_root: Fr,
    dest_address_root: Fr,
    enabled: Fr,
    travel_rule_threshold: Fr,
) -> Fr {
    let label = poseidon2_hash1(mod_u128(CORRIDOR_DOMAIN_TAG));
    poseidon2_hash10([
        label,
        mod_fr(corridor_id),
        mod_fr(source_jurisdiction_root),
        mod_fr(dest_address_root),
        mod_fr(travel_rule_threshold),
        mod_fr(enabled),
        mod_fr(Fr::from(0u64)),
        mod_fr(Fr::from(0u64)),
        mod_fr(Fr::from(0u64)),
        mod_fr(Fr::from(0u64)),
    ])
}

#[allow(clippy::too_many_arguments)]
pub fn compute_nullifier(
    credential_secret: Fr,
    issuer_lo: Fr,
    issuer_hi: Fr,
    sender_lo: Fr,
    sender_hi: Fr,
    asset_lo: Fr,
    asset_hi: Fr,
    epoch: Fr,
    recipient_lo: Fr,
    recipient_hi: Fr,
    amount: Fr,
    corridor_id: Fr,
    transfer_nonce: Fr,
) -> Fr {
    let domain = poseidon2_hash1(mod_u128(NULLIFIER_DOMAIN_TAG));
    let issuer = crate::poseidon2::poseidon2_hash2(issuer_lo, issuer_hi);
    let sender = crate::poseidon2::poseidon2_hash2(sender_lo, sender_hi);
    poseidon2_hash12([
        domain,
        mod_fr(credential_secret),
        issuer,
        sender,
        mod_fr(asset_lo),
        mod_fr(asset_hi),
        mod_fr(epoch),
        mod_fr(recipient_lo),
        mod_fr(recipient_hi),
        mod_fr(amount),
        mod_fr(corridor_id),
        mod_fr(transfer_nonce),
    ])
}

#[allow(clippy::too_many_arguments)]
pub fn compute_credential_commitment(
    issuer_lo: Fr,
    issuer_hi: Fr,
    sender_lo: Fr,
    sender_hi: Fr,
    credential_secret: Fr,
    jurisdiction: Fr,
    credential_expiry: Fr,
) -> Fr {
    let domain = poseidon2_hash1(mod_u128(CREDENTIAL_DOMAIN_TAG));
    poseidon2_hash10([
        domain,
        mod_fr(issuer_lo),
        mod_fr(issuer_hi),
        mod_fr(sender_lo),
        mod_fr(sender_hi),
        mod_fr(credential_secret),
        mod_fr(jurisdiction),
        mod_fr(credential_expiry),
        Fr::from(0u64),
        Fr::from(0u64),
    ])
}
