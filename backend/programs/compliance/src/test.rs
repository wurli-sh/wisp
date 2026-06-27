#![cfg(test)]
extern crate std;

use core::str::FromStr;
use std::string::String as StdString;

use ark_bn254::{Fq, Fr as ArkFr};
use ark_ff::{BigInteger, PrimeField};
use serde::Deserialize;
use soroban_sdk::{
    address_payload::AddressPayload,
    crypto::bn254::{
        Bn254G1Affine, Bn254G2Affine, Fr, BN254_G1_SERIALIZED_SIZE, BN254_G2_SERIALIZED_SIZE,
    },
    testutils::{Address as _, Ledger},
    token::TokenClient,
    Address, Bytes, BytesN, Env, IntoVal, String, Vec, U256,
};

use crate::test_sac::{TestSac, TestSacClient};
use crate::{
    public_inputs::{
        address_to_field_limbs, bytes16_to_fr, public_inputs_match, rebuild_expected_public_inputs,
    },
    storage::MAX_ISSUER_PAGE_SIZE,
    Compliance, ComplianceClient, CompliantTransferArgs, Proof,
};
use verifier::{
    Groth16Verifier, Groth16VerifierClient as ExternalGroth16VerifierClient, Proof as ExternalProof,
};

const REGISTRATION_FEE: i128 = 100;

const DEMO_SENDER: [u8; 32] = [
    0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff,
    0x10, 0x32, 0x54, 0x76, 0x98, 0xba, 0xdc, 0xfe, 0xef, 0xcd, 0xab, 0x89, 0x67, 0x45, 0x23, 0x01,
];
const DEMO_RECIPIENT: [u8; 32] = [
    0x10, 0x21, 0x32, 0x43, 0x54, 0x65, 0x76, 0x87, 0x98, 0xa9, 0xba, 0xbb, 0xdc, 0xed, 0xfe, 0x0f,
    0x0f, 0x1e, 0x2d, 0x3c, 0x4b, 0x5a, 0x69, 0x78, 0x87, 0x96, 0xa5, 0xb4, 0xc3, 0xd2, 0xe1, 0xf0,
];
const DEMO_ASSET: [u8; 32] = [
    0xff, 0xee, 0xdd, 0xcc, 0xbb, 0xaa, 0x99, 0x88, 0x77, 0x66, 0x55, 0x44, 0x33, 0x22, 0x11, 0x00,
    0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0xfe, 0xdc, 0xba, 0x98, 0x76, 0x54, 0x32, 0x10,
];

#[derive(Deserialize)]
struct DemoTransferJson {
    sender_hex: StdString,
    recipient_hex: StdString,
    asset_hex: StdString,
}

#[derive(Deserialize)]
struct SnarkProof {
    pi_a: [StdString; 3],
    pi_b: [[StdString; 2]; 3],
    pi_c: [StdString; 3],
}

#[derive(Deserialize)]
struct FixtureInput {
    sanctions_root: StdString,
    jurisdiction_root: StdString,
    corridor_config_hash: StdString,
    source_jurisdiction_root: StdString,
    dest_address_root: StdString,
    corridor_id: StdString,
}

fn hex_to_array32(hex: &str) -> [u8; 32] {
    let mut out = [0u8; 32];
    for (i, chunk) in hex.as_bytes().chunks(2).enumerate() {
        let s = std::str::from_utf8(chunk).unwrap();
        out[i] = u8::from_str_radix(s, 16).unwrap();
    }
    out
}

fn fq_to_be_bytes(fq: &Fq) -> [u8; 32] {
    let mut out = [0u8; 32];
    let bytes = fq.into_bigint().to_bytes_be();
    out[32 - bytes.len()..].copy_from_slice(&bytes);
    out
}

fn g1_from_snarkjs(env: &Env, x: &str, y: &str) -> Bn254G1Affine {
    let mut buf = [0u8; BN254_G1_SERIALIZED_SIZE];
    buf[..32].copy_from_slice(&fq_to_be_bytes(&Fq::from_str(x).unwrap()));
    buf[32..].copy_from_slice(&fq_to_be_bytes(&Fq::from_str(y).unwrap()));
    Bn254G1Affine::from_array(env, &buf)
}

fn g2_from_snarkjs(env: &Env, x0: &str, x1: &str, y0: &str, y1: &str) -> Bn254G2Affine {
    let mut buf = [0u8; BN254_G2_SERIALIZED_SIZE];
    buf[0..32].copy_from_slice(&fq_to_be_bytes(&Fq::from_str(x1).unwrap()));
    buf[32..64].copy_from_slice(&fq_to_be_bytes(&Fq::from_str(x0).unwrap()));
    buf[64..96].copy_from_slice(&fq_to_be_bytes(&Fq::from_str(y1).unwrap()));
    buf[96..128].copy_from_slice(&fq_to_be_bytes(&Fq::from_str(y0).unwrap()));
    Bn254G2Affine::from_array(env, &buf)
}

fn fr_from_decimal(env: &Env, s: &str) -> Fr {
    let ark = ArkFr::from_str(s).unwrap();
    let mut padded = [0u8; 32];
    let bytes = ark.into_bigint().to_bytes_be();
    padded[32 - bytes.len()..].copy_from_slice(&bytes);
    Fr::from_u256(U256::from_be_bytes(env, &Bytes::from_array(env, &padded)))
}

fn fr_to_bytes32(env: &Env, fr: &Fr) -> BytesN<32> {
    let mut arr = [0u8; 32];
    fr.to_u256().to_be_bytes().copy_into_slice(&mut arr);
    BytesN::from_array(env, &arr)
}

fn field_decimal_to_bytes32(env: &Env, decimal: &str) -> BytesN<32> {
    fr_to_bytes32(env, &fr_from_decimal(env, decimal))
}

fn load_fixture() -> (SnarkProof, std::vec::Vec<StdString>, FixtureInput) {
    let proof: SnarkProof = serde_json::from_str(include_str!(
        "../../../../circuits/circom/artifacts/proof.json"
    ))
    .unwrap();
    let public: std::vec::Vec<StdString> = serde_json::from_str(include_str!(
        "../../../../circuits/circom/artifacts/public.json"
    ))
    .unwrap();
    let input: FixtureInput = serde_json::from_str(include_str!(
        "../../../../circuits/circom/inputs/valid.us-mx.json"
    ))
    .unwrap();
    (proof, public, input)
}

fn proof_from_snarkjs(env: &Env, raw: &SnarkProof) -> Proof {
    Proof {
        a: g1_from_snarkjs(env, &raw.pi_a[0], &raw.pi_a[1]),
        b: g2_from_snarkjs(
            env,
            &raw.pi_b[0][0],
            &raw.pi_b[0][1],
            &raw.pi_b[1][0],
            &raw.pi_b[1][1],
        ),
        c: g1_from_snarkjs(env, &raw.pi_c[0], &raw.pi_c[1]),
    }
}

fn external_proof_from_snarkjs(env: &Env, raw: &SnarkProof) -> ExternalProof {
    let proof = proof_from_snarkjs(env, raw);
    ExternalProof {
        a: proof.a,
        b: proof.b,
        c: proof.c,
    }
}

fn public_signals(env: &Env, values: &[StdString]) -> Vec<Fr> {
    let mut out = Vec::new(env);
    for v in values {
        out.push_back(fr_from_decimal(env, v));
    }
    out
}

fn contract_address(env: &Env, bytes: [u8; 32]) -> Address {
    AddressPayload::ContractIdHash(BytesN::from_array(env, &bytes)).to_address(env)
}

/// Rebuild an address from its (lo, hi) field limbs as emitted by the circuit:
/// `hi` is the high 16 address bytes, `lo` is the low 16. Each limb is a field
/// whose 32-byte big-endian form carries the 16 meaningful bytes in [16..32].
fn issuer_address_from_limbs(env: &Env, lo_decimal: &str, hi_decimal: &str) -> Address {
    let lo32 = field_decimal_to_bytes32(env, lo_decimal).to_array();
    let hi32 = field_decimal_to_bytes32(env, hi_decimal).to_array();
    let mut bytes = [0u8; 32];
    bytes[0..16].copy_from_slice(&hi32[16..32]);
    bytes[16..32].copy_from_slice(&lo32[16..32]);
    contract_address(env, bytes)
}

fn split_address_bytes(bytes: &[u8; 32]) -> ([u8; 16], [u8; 16]) {
    let mut hi = [0u8; 16];
    let mut lo = [0u8; 16];
    hi.copy_from_slice(&bytes[0..16]);
    lo.copy_from_slice(&bytes[16..32]);
    (hi, lo)
}

fn metadata_uri(env: &Env, suffix: &str) -> String {
    String::from_str(env, suffix)
}

struct Initialized {
    compliance_id: Address,
    fee_token: Address,
    treasury: Address,
}

fn init_compliance(env: &Env) -> Initialized {
    let verifier_id = env.register(Groth16Verifier, ());
    let vk_hash = ExternalGroth16VerifierClient::new(env, &verifier_id).vk_hash();
    let fee_token = contract_address(env, [0x44; 32]);
    env.register_at(&fee_token, TestSac, ());
    let admin = Address::generate(env);
    let treasury = Address::generate(env);
    let compliance_id = env.register(Compliance, ());
    ComplianceClient::new(env, &compliance_id).initialize(
        &admin,
        &treasury,
        &fee_token,
        &REGISTRATION_FEE,
        &verifier_id,
        &vk_hash,
    );
    Initialized {
        compliance_id,
        fee_token,
        treasury,
    }
}

struct ComplianceFixture {
    proof: Proof,
    public: Vec<Fr>,
    public_decimal: std::vec::Vec<StdString>,
    input: FixtureInput,
    issuer: Address,
    sender: Address,
    recipient: Address,
    asset: Address,
    fee_token: Address,
}

fn setup_compliance_fixture(fund_sender: bool) -> (Env, Address, ComplianceFixture) {
    let env = Env::default();
    env.ledger().set_timestamp(1_779_840_000);
    env.mock_all_auths();

    let initialized = init_compliance(&env);
    let compliance = ComplianceClient::new(&env, &initialized.compliance_id);

    let (raw_proof, public, fixture) = load_fixture();
    let proof = proof_from_snarkjs(&env, &raw_proof);
    let signals = public_signals(&env, &public);
    env.ledger()
        .set_timestamp(public[12].parse::<u64>().unwrap());

    // The issuer is now bound into the proof's public inputs (issuer_lo/_hi at
    // indices 17/18), so it must be the exact address whose limbs the circuit
    // committed to — not a random one.
    let issuer = issuer_address_from_limbs(&env, &public[17], &public[18]);
    let fee = TestSacClient::new(&env, &initialized.fee_token);
    fee.mint(&issuer, &REGISTRATION_FEE);
    compliance.register_issuer(
        &issuer,
        &metadata_uri(&env, "https://issuer.example/.well-known/wisp-issuer.json"),
    );
    compliance.update_issuer_root(
        &issuer,
        &field_decimal_to_bytes32(&env, &public[0]),
        &field_decimal_to_bytes32(&env, &public[10]),
        &field_decimal_to_bytes32(&env, &public[11]),
    );
    compliance.register_corridor(
        &issuer,
        &fixture.corridor_id.parse().unwrap(),
        &field_decimal_to_bytes32(&env, &public[15]),
        &field_decimal_to_bytes32(&env, &public[16]),
        &field_decimal_to_bytes32(&env, &public[14]),
    );

    let asset = contract_address(&env, DEMO_ASSET);
    env.register_at(&asset, TestSac, ());
    let sac = TestSacClient::new(&env, &asset);
    let sender = contract_address(&env, DEMO_SENDER);
    let recipient = contract_address(&env, DEMO_RECIPIENT);
    if fund_sender {
        let amount: i128 = public[9].parse().unwrap();
        sac.mint(&sender, &amount);
        sac.approve(&sender, &initialized.compliance_id, &amount, &0);
    }

    (
        env,
        initialized.compliance_id,
        ComplianceFixture {
            proof,
            public: signals,
            public_decimal: public,
            input: fixture,
            issuer,
            sender,
            recipient,
            asset,
            fee_token: initialized.fee_token,
        },
    )
}

fn transfer_args(env: &Env, fixture: &ComplianceFixture) -> CompliantTransferArgs {
    CompliantTransferArgs {
        issuer: fixture.issuer.clone(),
        asset: fixture.asset.clone(),
        sender: fixture.sender.clone(),
        recipient: fixture.recipient.clone(),
        amount: fixture.public_decimal[9].parse().unwrap(),
        corridor_id: fixture.input.corridor_id.parse().unwrap(),
        epoch: fixture.public_decimal[6].parse().unwrap(),
        nullifier: fr_to_bytes32(env, &fixture.public.get(1).unwrap()),
    }
}

fn tampered_proof(env: &Env, raw: &SnarkProof) -> Proof {
    let proof = proof_from_snarkjs(env, raw);
    Proof {
        a: proof.c.clone(),
        b: proof.b.clone(),
        c: proof.a.clone(),
    }
}

#[test]
fn demo_bytes_match_shared_fixture() {
    let demo: DemoTransferJson = serde_json::from_str(include_str!(
        "../../../../bindings/fixtures/demo-transfer.json"
    ))
    .unwrap();
    assert_eq!(hex_to_array32(&demo.sender_hex), DEMO_SENDER);
    assert_eq!(hex_to_array32(&demo.recipient_hex), DEMO_RECIPIENT);
    assert_eq!(hex_to_array32(&demo.asset_hex), DEMO_ASSET);
}

#[test]
fn public_input_count_matches_generated_abi() {
    assert_eq!(crate::storage::PUBLIC_INPUT_COUNT, 19);
}

#[test]
fn verifier_accepts_valid_fixture() {
    let env = Env::default();
    let verifier_id = env.register(Groth16Verifier, ());
    let verifier = ExternalGroth16VerifierClient::new(&env, &verifier_id);
    let (raw_proof, public, _) = load_fixture();
    let proof = external_proof_from_snarkjs(&env, &raw_proof);
    let signals = public_signals(&env, &public);
    assert!(verifier.verify_proof(&proof, &signals));
}

#[test]
fn fixture_public_inputs_match_contract_binding() {
    let env = Env::default();
    let (_, public, fixture) = load_fixture();
    env.ledger()
        .set_timestamp(public[12].parse::<u64>().unwrap());
    let signals = public_signals(&env, &public);
    let sender = contract_address(&env, DEMO_SENDER);
    let recipient = contract_address(&env, DEMO_RECIPIENT);
    let asset = contract_address(&env, DEMO_ASSET);
    let issuer = issuer_address_from_limbs(&env, &public[17], &public[18]);
    let nullifier = fr_to_bytes32(&env, &signals.get(1).unwrap());

    let expected = rebuild_expected_public_inputs(
        &env,
        &field_decimal_to_bytes32(&env, &public[0]),
        &nullifier,
        &asset,
        &sender,
        &recipient,
        public[9].parse().unwrap(),
        &field_decimal_to_bytes32(&env, &public[10]),
        &field_decimal_to_bytes32(&env, &public[11]),
        public[6].parse().unwrap(),
        fixture.corridor_id.parse().unwrap(),
        &field_decimal_to_bytes32(&env, &public[14]),
        &field_decimal_to_bytes32(&env, &public[15]),
        &field_decimal_to_bytes32(&env, &public[16]),
        &issuer,
    );
    assert!(public_inputs_match(&expected, &signals));
}

#[test]
fn address_limb_order_matches_circuit_schema() {
    let env = Env::default();
    let addr = contract_address(&env, DEMO_SENDER);
    let (hi_bytes, lo_bytes) = split_address_bytes(&DEMO_SENDER);
    let (lo, hi) = address_to_field_limbs(&env, &addr);
    assert_eq!(lo, bytes16_to_fr(&env, &lo_bytes));
    assert_eq!(hi, bytes16_to_fr(&env, &hi_bytes));
}

#[test]
fn issuer_self_registers_with_fee_and_paginates() {
    let env = Env::default();
    env.mock_all_auths();
    let initialized = init_compliance(&env);
    let compliance = ComplianceClient::new(&env, &initialized.compliance_id);
    let fee = TestSacClient::new(&env, &initialized.fee_token);

    let issuer_a = Address::generate(&env);
    let issuer_b = Address::generate(&env);
    fee.mint(&issuer_a, &REGISTRATION_FEE);
    fee.mint(&issuer_b, &REGISTRATION_FEE);

    compliance.register_issuer(
        &issuer_a,
        &metadata_uri(&env, "https://a.example/.well-known/wisp-issuer.json"),
    );
    compliance.register_issuer(
        &issuer_b,
        &metadata_uri(&env, "https://b.example/.well-known/wisp-issuer.json"),
    );

    assert_eq!(
        TokenClient::new(&env, &initialized.fee_token).balance(&initialized.treasury),
        200
    );
    let issuer = compliance.get_issuer(&issuer_a).unwrap();
    assert_eq!(issuer.registration_seq, 0);
    assert_eq!(issuer.enabled, true);

    let page = compliance.list_issuers(&Some(0), &1);
    assert_eq!(page.issuers.len(), 1);
    assert_eq!(page.next_cursor, Some(1));
    assert_eq!(page.issuers.get(0).unwrap().issuer, issuer_a);

    let tail = compliance.list_issuers(&page.next_cursor, &MAX_ISSUER_PAGE_SIZE);
    assert_eq!(tail.issuers.len(), 1);
    assert_eq!(tail.issuers.get(0).unwrap().issuer, issuer_b);
    assert_eq!(tail.next_cursor, None);
}

#[test]
fn registration_without_fee_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let initialized = init_compliance(&env);
    let compliance = ComplianceClient::new(&env, &initialized.compliance_id);
    let issuer = Address::generate(&env);
    assert!(compliance
        .try_register_issuer(
            &issuer,
            &metadata_uri(&env, "https://issuer.example/.well-known/wisp-issuer.json")
        )
        .is_err());
}

#[test]
fn metadata_update_requires_issuer_auth() {
    let env = Env::default();
    env.mock_all_auths();
    let initialized = init_compliance(&env);
    let compliance = ComplianceClient::new(&env, &initialized.compliance_id);
    let fee = TestSacClient::new(&env, &initialized.fee_token);
    let issuer = Address::generate(&env);
    let stranger = Address::generate(&env);
    fee.mint(&issuer, &REGISTRATION_FEE);
    compliance.register_issuer(
        &issuer,
        &metadata_uri(&env, "https://issuer.example/old.json"),
    );

    env.set_auths(&[]);
    env.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &stranger,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &initialized.compliance_id,
            fn_name: "update_issuer_metadata",
            args: (
                issuer.clone(),
                metadata_uri(&env, "https://issuer.example/new.json"),
            )
                .into_val(&env),
            sub_invokes: &[],
        },
    }]);
    assert!(compliance
        .try_update_issuer_metadata(
            &issuer,
            &metadata_uri(&env, "https://issuer.example/new.json")
        )
        .is_err());

    env.mock_all_auths();
    compliance.update_issuer_metadata(
        &issuer,
        &metadata_uri(&env, "https://issuer.example/new.json"),
    );
    let updated = compliance.get_issuer(&issuer).unwrap();
    assert_eq!(
        updated.metadata_uri,
        metadata_uri(&env, "https://issuer.example/new.json")
    );
}

#[test]
fn corridor_namespace_is_scoped_by_issuer() {
    let env = Env::default();
    env.mock_all_auths();
    let initialized = init_compliance(&env);
    let compliance = ComplianceClient::new(&env, &initialized.compliance_id);
    let fee = TestSacClient::new(&env, &initialized.fee_token);
    let zeros = BytesN::from_array(&env, &[0u8; 32]);

    let issuer_a = Address::generate(&env);
    let issuer_b = Address::generate(&env);
    fee.mint(&issuer_a, &REGISTRATION_FEE);
    fee.mint(&issuer_b, &REGISTRATION_FEE);
    compliance.register_issuer(
        &issuer_a,
        &metadata_uri(&env, "https://a.example/issuer.json"),
    );
    compliance.register_issuer(
        &issuer_b,
        &metadata_uri(&env, "https://b.example/issuer.json"),
    );
    compliance.register_corridor(
        &issuer_a,
        &1,
        &zeros,
        &zeros,
        &BytesN::from_array(&env, &[1u8; 32]),
    );
    compliance.register_corridor(
        &issuer_b,
        &1,
        &zeros,
        &zeros,
        &BytesN::from_array(&env, &[2u8; 32]),
    );

    let a = compliance.get_corridor(&issuer_a, &1).unwrap();
    let b = compliance.get_corridor(&issuer_b, &1).unwrap();
    assert_ne!(a.corridor_config_hash, b.corridor_config_hash);
}

#[test]
fn compliant_transfer_moves_tokens_and_records_nullifier() {
    let (env, compliance_id, fixture) = setup_compliance_fixture(true);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    let args = transfer_args(&env, &fixture);
    let amount: i128 = fixture.public_decimal[9].parse().unwrap();
    let token = TokenClient::new(&env, &fixture.asset);

    assert_eq!(token.balance(&fixture.sender), amount);
    assert_eq!(token.balance(&fixture.recipient), 0);
    assert!(!compliance.check_attestation(&args.nullifier));

    compliance.compliant_transfer(&args, &fixture.proof, &fixture.public);

    assert_eq!(token.balance(&fixture.sender), 0);
    assert_eq!(token.balance(&fixture.recipient), amount);
    assert!(compliance.check_attestation(&args.nullifier));
}

#[test]
fn compliant_transfer_rejects_duplicate_nullifier() {
    let (env, compliance_id, fixture) = setup_compliance_fixture(true);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    let args = transfer_args(&env, &fixture);
    compliance.compliant_transfer(&args, &fixture.proof, &fixture.public);
    assert!(compliance
        .try_compliant_transfer(&args, &fixture.proof, &fixture.public)
        .is_err());
}

#[test]
fn compliant_transfer_rejects_registered_issuer_without_roots() {
    let (env, compliance_id, fixture) = setup_compliance_fixture(true);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    let fee = TestSacClient::new(&env, &fixture.fee_token);
    let issuer = Address::generate(&env);
    fee.mint(&issuer, &REGISTRATION_FEE);
    compliance.register_issuer(
        &issuer,
        &metadata_uri(&env, "https://fresh.example/issuer.json"),
    );
    compliance.register_corridor(
        &issuer,
        &fixture.input.corridor_id.parse().unwrap(),
        &field_decimal_to_bytes32(&env, &fixture.input.source_jurisdiction_root),
        &field_decimal_to_bytes32(&env, &fixture.input.dest_address_root),
        &field_decimal_to_bytes32(&env, &fixture.input.corridor_config_hash),
    );

    let mut args = transfer_args(&env, &fixture);
    args.issuer = issuer;
    assert!(compliance
        .try_compliant_transfer(&args, &fixture.proof, &fixture.public)
        .is_err());
}

#[test]
fn compliant_transfer_rejects_wrong_issuer_namespace_even_with_same_corridor_id() {
    let (env, compliance_id, fixture) = setup_compliance_fixture(true);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    let fee = TestSacClient::new(&env, &fixture.fee_token);
    let other_issuer = Address::generate(&env);
    fee.mint(&other_issuer, &REGISTRATION_FEE);
    compliance.register_issuer(
        &other_issuer,
        &metadata_uri(&env, "https://other.example/issuer.json"),
    );
    compliance.update_issuer_root(
        &other_issuer,
        &BytesN::from_array(&env, &[0xAB; 32]),
        &field_decimal_to_bytes32(&env, &fixture.input.sanctions_root),
        &field_decimal_to_bytes32(&env, &fixture.input.jurisdiction_root),
    );
    compliance.register_corridor(
        &other_issuer,
        &fixture.input.corridor_id.parse().unwrap(),
        &field_decimal_to_bytes32(&env, &fixture.input.source_jurisdiction_root),
        &field_decimal_to_bytes32(&env, &fixture.input.dest_address_root),
        &field_decimal_to_bytes32(&env, &fixture.input.corridor_config_hash),
    );

    let mut args = transfer_args(&env, &fixture);
    args.issuer = other_issuer;
    assert!(compliance
        .try_compliant_transfer(&args, &fixture.proof, &fixture.public)
        .is_err());
}

#[test]
fn compliant_transfer_rejects_invalid_proof() {
    let (env, compliance_id, fixture) = setup_compliance_fixture(true);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    let (raw_proof, _, _) = load_fixture();
    let bad_proof = tampered_proof(&env, &raw_proof);
    let args = transfer_args(&env, &fixture);
    assert!(compliance
        .try_compliant_transfer(&args, &bad_proof, &fixture.public)
        .is_err());
}

#[test]
fn compliant_transfer_rejects_disabled_corridor_and_disabled_issuer() {
    let (env, compliance_id, fixture) = setup_compliance_fixture(true);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    let args = transfer_args(&env, &fixture);

    compliance.update_corridor(
        &fixture.issuer,
        &fixture.input.corridor_id.parse().unwrap(),
        &field_decimal_to_bytes32(&env, &fixture.input.source_jurisdiction_root),
        &field_decimal_to_bytes32(&env, &fixture.input.dest_address_root),
        &field_decimal_to_bytes32(&env, &fixture.input.corridor_config_hash),
        &false,
    );
    assert!(compliance
        .try_compliant_transfer(&args, &fixture.proof, &fixture.public)
        .is_err());

    compliance.update_corridor(
        &fixture.issuer,
        &fixture.input.corridor_id.parse().unwrap(),
        &field_decimal_to_bytes32(&env, &fixture.input.source_jurisdiction_root),
        &field_decimal_to_bytes32(&env, &fixture.input.dest_address_root),
        &field_decimal_to_bytes32(&env, &fixture.input.corridor_config_hash),
        &true,
    );
    compliance.set_issuer_enabled(&fixture.issuer, &false);
    assert!(compliance
        .try_compliant_transfer(&args, &fixture.proof, &fixture.public)
        .is_err());
}

#[test]
fn compliant_transfer_rejects_zero_amount_stale_epoch_and_future_epoch() {
    let (env, compliance_id, fixture) = setup_compliance_fixture(true);
    let compliance = ComplianceClient::new(&env, &compliance_id);

    let mut zero = transfer_args(&env, &fixture);
    zero.amount = 0;
    assert!(compliance
        .try_compliant_transfer(&zero, &fixture.proof, &fixture.public)
        .is_err());

    let mut stale = transfer_args(&env, &fixture);
    stale.epoch = 0;
    assert!(compliance
        .try_compliant_transfer(&stale, &fixture.proof, &fixture.public)
        .is_err());

    let mut future = transfer_args(&env, &fixture);
    future.epoch = 999_999_999;
    assert!(compliance
        .try_compliant_transfer(&future, &fixture.proof, &fixture.public)
        .is_err());
}

#[test]
fn mock_sac_blocks_direct_transfer_when_router_enforced() {
    let env = Env::default();
    env.mock_all_auths();
    let asset = contract_address(&env, DEMO_ASSET);
    env.register_at(&asset, TestSac, ());
    let sac = TestSacClient::new(&env, &asset);
    sac.set_enforce_router(&true);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    sac.mint(&from, &1_000);
    assert!(sac.try_transfer(&from, &to, &100).is_err());
}
