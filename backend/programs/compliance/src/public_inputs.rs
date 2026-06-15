use soroban_sdk::{
    address_payload::AddressPayload, crypto::bn254::Fr, Address, Bytes, BytesN, Env, Vec, U256,
};

pub fn bytes16_to_fr(env: &Env, bytes: &[u8; 16]) -> Fr {
    let mut padded = [0u8; 32];
    padded[16..32].copy_from_slice(bytes);
    Fr::from_u256(U256::from_be_bytes(env, &Bytes::from_array(env, &padded)))
}

pub fn address_to_field_limbs(env: &Env, addr: &Address) -> (Fr, Fr) {
    let payload = addr.to_payload().expect("address payload");
    let bytes: [u8; 32] = match payload {
        AddressPayload::ContractIdHash(b) => b.to_array(),
        AddressPayload::AccountIdPublicKeyEd25519(b) => b.to_array(),
    };
    let mut hi = [0u8; 16];
    let mut lo = [0u8; 16];
    hi.copy_from_slice(&bytes[0..16]);
    lo.copy_from_slice(&bytes[16..32]);
    (bytes16_to_fr(env, &lo), bytes16_to_fr(env, &hi))
}

pub fn u64_to_fr(env: &Env, value: u64) -> Fr {
    Fr::from_u256(U256::from_u128(env, value as u128))
}

pub fn i128_to_fr(env: &Env, value: i128) -> Fr {
    if value < 0 {
        panic!("negative amount");
    }
    Fr::from_u256(U256::from_u128(env, value as u128))
}

pub fn u32_to_fr(env: &Env, value: u32) -> Fr {
    Fr::from_u256(U256::from_u32(env, value))
}

pub fn bytes32_to_fr(env: &Env, bytes: &BytesN<32>) -> Fr {
    Fr::from_u256(U256::from_be_bytes(env, &bytes.to_bytes()))
}

#[allow(clippy::too_many_arguments)]
pub fn rebuild_expected_public_inputs(
    env: &Env,
    merkle_root: &BytesN<32>,
    nullifier: &BytesN<32>,
    asset: &Address,
    sender: &Address,
    recipient: &Address,
    amount: i128,
    sanctions_root: &BytesN<32>,
    jurisdiction_root: &BytesN<32>,
    epoch: u64,
    corridor_id: u32,
    corridor_config_hash: &BytesN<32>,
    source_jurisdiction_root: &BytesN<32>,
    dest_address_root: &BytesN<32>,
) -> Vec<Fr> {
    let (asset_lo, asset_hi) = address_to_field_limbs(env, asset);
    let (sender_lo, sender_hi) = address_to_field_limbs(env, sender);
    let (recipient_lo, recipient_hi) = address_to_field_limbs(env, recipient);
    let timestamp = epoch
        .checked_mul(super::storage::EPOCH_LEN_SECS)
        .expect("epoch overflow");

    soroban_sdk::vec![
        env,
        bytes32_to_fr(env, merkle_root),
        bytes32_to_fr(env, nullifier),
        asset_lo,
        asset_hi,
        sender_lo,
        sender_hi,
        u64_to_fr(env, epoch),
        recipient_lo,
        recipient_hi,
        i128_to_fr(env, amount),
        bytes32_to_fr(env, sanctions_root),
        bytes32_to_fr(env, jurisdiction_root),
        u64_to_fr(env, timestamp),
        u32_to_fr(env, corridor_id),
        bytes32_to_fr(env, corridor_config_hash),
        bytes32_to_fr(env, source_jurisdiction_root),
        bytes32_to_fr(env, dest_address_root),
    ]
}

pub fn public_inputs_match(expected: &Vec<Fr>, supplied: &Vec<Fr>) -> bool {
    if expected.len() != supplied.len() {
        return false;
    }
    for i in 0..expected.len() {
        if expected.get(i).unwrap() != supplied.get(i).unwrap() {
            return false;
        }
    }
    true
}
