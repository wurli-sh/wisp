use std::fs;
use std::path::PathBuf;

use serde::Deserialize;

use amoeba_crypto::{
    address_to_limbs, assert_fr_eq, compute_corridor_config_hash, compute_nullifier,
    fr_from_decimal, merkle_root_for_leaf_at_index, mod_u128, poseidon2_hash1, poseidon2_hash2,
    sparse_sanctions_path, NULLIFIER_DOMAIN_TAG,
};

fn zero_string() -> String {
    "0".to_string()
}

fn fixture_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../../bindings/fixtures")
        .join(name)
}

fn parse_hex(hex: &str) -> Vec<u8> {
    hex.as_bytes()
        .chunks(2)
        .map(|chunk| {
            let pair = std::str::from_utf8(chunk).expect("valid hex");
            u8::from_str_radix(pair, 16).expect("valid hex digit")
        })
        .collect()
}

fn parse_hex32(hex: &str) -> Vec<u8> {
    let bytes = parse_hex(hex);
    assert_eq!(bytes.len(), 32, "expected 32-byte hex");
    bytes
}

#[derive(Deserialize)]
struct LimbEntry {
    hex: Option<String>,
    lo: String,
    hi: String,
}

#[derive(Deserialize)]
struct CryptoFixtures {
    address_limbs: AddressLimbsFixture,
    poseidon2: Poseidon2Fixture,
    merkle: MerkleFixture,
    nullifier: String,
    corridor_config_hash: String,
}

#[derive(Deserialize)]
struct AddressLimbsFixture {
    demo_sender: LimbEntry,
    demo_recipient: LimbEntry,
    demo_asset: LimbEntry,
}

#[derive(Deserialize)]
struct Poseidon2Fixture {
    nullifier_domain: String,
    sender_leaf: String,
    jurisdiction_leaf: String,
    dest_leaf: String,
}

#[derive(Deserialize)]
struct MerkleFixture {
    merkle_root: String,
    jurisdiction_root: String,
    source_jurisdiction_root: String,
    dest_address_root: String,
    sanctions_root: String,
}

#[derive(Deserialize)]
struct AddressesFixture {
    demo_sender_hex: LimbEntry,
    stellar_g_address: StellarAddressEntry,
    stellar_c_contract: StellarAddressEntry,
}

#[derive(Deserialize)]
struct StellarAddressEntry {
    payload_hex: String,
    lo: String,
    hi: String,
}

#[derive(Deserialize)]
struct DemoTransfer {
    credential_secret: String,
    #[serde(default = "zero_string")]
    transfer_nonce: String,
    corridor_id: u64,
    sender_hex: String,
    recipient_hex: String,
    asset_hex: String,
    amount: String,
    epoch: String,
    jurisdiction: String,
}

fn assert_limbs(bytes: &[u8], expected_lo: &str, expected_hi: &str) {
    let limbs = address_to_limbs(bytes);
    assert_fr_eq(limbs.lo, expected_lo);
    assert_fr_eq(limbs.hi, expected_hi);
}

#[test]
fn crypto_fixtures_match_js() {
    let crypto: CryptoFixtures = serde_json::from_str(
        &fs::read_to_string(fixture_path("crypto.json")).expect("crypto.json"),
    )
    .expect("parse crypto.json");
    let demo: DemoTransfer = serde_json::from_str(
        &fs::read_to_string(fixture_path("demo-transfer.json")).expect("demo-transfer.json"),
    )
    .expect("parse demo-transfer.json");

    let sender = parse_hex32(&demo.sender_hex);
    let recipient = parse_hex32(&demo.recipient_hex);
    let asset = parse_hex32(&demo.asset_hex);

    let sender_limbs = address_to_limbs(&sender);
    let recipient_limbs = address_to_limbs(&recipient);
    let asset_limbs = address_to_limbs(&asset);

    assert_limbs(
        &sender,
        &crypto.address_limbs.demo_sender.lo,
        &crypto.address_limbs.demo_sender.hi,
    );
    assert_limbs(
        &recipient,
        &crypto.address_limbs.demo_recipient.lo,
        &crypto.address_limbs.demo_recipient.hi,
    );
    assert_limbs(
        &asset,
        &crypto.address_limbs.demo_asset.lo,
        &crypto.address_limbs.demo_asset.hi,
    );

    let nullifier_domain = poseidon2_hash1(mod_u128(NULLIFIER_DOMAIN_TAG));
    assert_fr_eq(nullifier_domain, &crypto.poseidon2.nullifier_domain);

    let sender_leaf = poseidon2_hash2(sender_limbs.lo, sender_limbs.hi);
    assert_fr_eq(sender_leaf, &crypto.poseidon2.sender_leaf);

    let jurisdiction = fr_from_decimal(&demo.jurisdiction);
    let jurisdiction_leaf = poseidon2_hash1(jurisdiction);
    assert_fr_eq(jurisdiction_leaf, &crypto.poseidon2.jurisdiction_leaf);

    let dest_leaf = poseidon2_hash2(recipient_limbs.lo, recipient_limbs.hi);
    assert_fr_eq(dest_leaf, &crypto.poseidon2.dest_leaf);

    let merkle_root = merkle_root_for_leaf_at_index(sender_leaf, 0, amoeba_crypto::MERKLE_DEPTH);
    assert_fr_eq(merkle_root, &crypto.merkle.merkle_root);

    let jurisdiction_root =
        merkle_root_for_leaf_at_index(jurisdiction_leaf, 0, amoeba_crypto::MERKLE_DEPTH);
    assert_fr_eq(jurisdiction_root, &crypto.merkle.jurisdiction_root);
    assert_fr_eq(jurisdiction_root, &crypto.merkle.source_jurisdiction_root);

    let dest_address_root =
        merkle_root_for_leaf_at_index(dest_leaf, 0, amoeba_crypto::MERKLE_DEPTH);
    assert_fr_eq(dest_address_root, &crypto.merkle.dest_address_root);

    let sanctions = sparse_sanctions_path(
        sender_limbs.lo,
        sender_limbs.hi,
        amoeba_crypto::MERKLE_DEPTH,
    );
    assert_fr_eq(sanctions.root, &crypto.merkle.sanctions_root);

    let nullifier = compute_nullifier(
        fr_from_decimal(&demo.credential_secret),
        sender_limbs.lo,
        sender_limbs.hi,
        asset_limbs.lo,
        asset_limbs.hi,
        fr_from_decimal(&demo.epoch),
        recipient_limbs.lo,
        recipient_limbs.hi,
        fr_from_decimal(&demo.amount),
        fr_from_decimal(&demo.corridor_id.to_string()),
        fr_from_decimal(&demo.transfer_nonce),
    );
    assert_fr_eq(nullifier, &crypto.nullifier);

    let corridor_config_hash = compute_corridor_config_hash(
        fr_from_decimal(&demo.corridor_id.to_string()),
        jurisdiction_root,
        dest_address_root,
        fr_from_decimal("1"),
        fr_from_decimal("0"),
    );
    assert_fr_eq(corridor_config_hash, &crypto.corridor_config_hash);
}

#[test]
fn address_fixtures_match_js() {
    let addresses: AddressesFixture = serde_json::from_str(
        &fs::read_to_string(fixture_path("addresses.json")).expect("addresses.json"),
    )
    .expect("parse addresses.json");

    let demo_sender = parse_hex32(
        addresses
            .demo_sender_hex
            .hex
            .as_deref()
            .expect("demo sender hex"),
    );
    assert_limbs(
        &demo_sender,
        &addresses.demo_sender_hex.lo,
        &addresses.demo_sender_hex.hi,
    );

    let g_payload = parse_hex(&addresses.stellar_g_address.payload_hex);
    assert_limbs(
        &g_payload,
        &addresses.stellar_g_address.lo,
        &addresses.stellar_g_address.hi,
    );

    let c_payload = parse_hex(&addresses.stellar_c_contract.payload_hex);
    assert_limbs(
        &c_payload,
        &addresses.stellar_c_contract.lo,
        &addresses.stellar_c_contract.hi,
    );
}
