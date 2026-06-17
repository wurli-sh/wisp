#![cfg(test)]
extern crate std;

use core::str::FromStr;
use std::string::String;

use ark_bn254::{Fq, Fr as ArkFr};
use ark_ff::{BigInteger, PrimeField};
use serde::Deserialize;
use soroban_sdk::{
    address_payload::AddressPayload,
    crypto::bn254::{
        Bn254G1Affine, Bn254G2Affine, Fr, BN254_G1_SERIALIZED_SIZE, BN254_G2_SERIALIZED_SIZE,
    },
    testutils::{Address as _, Events, Ledger},
    token::TokenClient,
    Address, Bytes, BytesN, Env, IntoVal, Vec, U256,
};

use crate::test_sac::{TestSac, TestSacClient};
use crate::{
    public_inputs::{
        address_to_field_limbs, bytes16_to_fr, public_inputs_match, rebuild_expected_public_inputs,
    },
    Compliance, ComplianceClient, CompliantTransferArgs, Proof,
};
use verifier::{
    Groth16Verifier, Groth16VerifierClient as ExternalGroth16VerifierClient, Proof as ExternalProof,
};

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
    sender_hex: String,
    recipient_hex: String,
    asset_hex: String,
}

fn hex_to_array32(hex: &str) -> [u8; 32] {
    let mut out = [0u8; 32];
    for (i, chunk) in hex.as_bytes().chunks(2).enumerate() {
        let s = std::str::from_utf8(chunk).unwrap();
        out[i] = u8::from_str_radix(s, 16).unwrap();
    }
    out
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
    assert_eq!(crate::storage::PUBLIC_INPUT_COUNT, 17);
}

#[derive(Deserialize)]
struct SnarkProof {
    pi_a: [String; 3],
    pi_b: [[String; 2]; 3],
    pi_c: [String; 3],
}

#[derive(Deserialize)]
struct FixtureInput {
    merkle_root: String,
    nullifier: String,
    sanctions_root: String,
    jurisdiction_root: String,
    corridor_config_hash: String,
    source_jurisdiction_root: String,
    dest_address_root: String,
    epoch: String,
    amount: String,
    corridor_id: String,
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

fn field_decimal_to_bytes32(env: &Env, decimal: &str) -> BytesN<32> {
    let fr = fr_from_decimal(env, decimal);
    fr_to_bytes32(env, &fr)
}

fn fr_to_bytes32(env: &Env, fr: &Fr) -> BytesN<32> {
    let mut arr = [0u8; 32];
    fr.to_u256().to_be_bytes().copy_into_slice(&mut arr);
    BytesN::from_array(env, &arr)
}

fn load_fixture() -> (SnarkProof, std::vec::Vec<String>, FixtureInput) {
    let proof: SnarkProof = serde_json::from_str(include_str!(
        "../../../../circuits/circom/artifacts/proof.json"
    ))
    .unwrap();
    let public: std::vec::Vec<String> = serde_json::from_str(include_str!(
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

fn public_signals(env: &Env, values: &[String]) -> Vec<Fr> {
    let mut out = Vec::new(env);
    for v in values {
        out.push_back(fr_from_decimal(env, v));
    }
    out
}

fn contract_address(env: &Env, bytes: [u8; 32]) -> Address {
    AddressPayload::ContractIdHash(BytesN::from_array(env, &bytes)).to_address(env)
}

fn split_address_bytes(bytes: &[u8; 32]) -> ([u8; 16], [u8; 16]) {
    let mut hi = [0u8; 16];
    let mut lo = [0u8; 16];
    hi.copy_from_slice(&bytes[0..16]);
    lo.copy_from_slice(&bytes[16..32]);
    (hi, lo)
}

struct ComplianceFixture {
    proof: Proof,
    public: Vec<Fr>,
    public_decimal: std::vec::Vec<String>,
    input: FixtureInput,
    issuer: Address,
    sender: Address,
    recipient: Address,
    asset: Address,
}

fn setup_compliance_fixture(fund_sender: bool) -> (Env, Address, ComplianceFixture) {
    let env = Env::default();
    env.ledger().set_timestamp(1_779_840_000);
    env.mock_all_auths();

    let verifier_id = env.register(Groth16Verifier, ());
    let verifier = ExternalGroth16VerifierClient::new(&env, &verifier_id);
    let vk_hash = verifier.vk_hash();

    let admin = Address::generate(&env);
    let compliance_id = env.register(Compliance, ());
    let compliance = ComplianceClient::new(&env, &compliance_id);
    compliance.initialize(&admin, &verifier_id, &vk_hash);

    let (raw_proof, public, fixture) = load_fixture();
    let proof = proof_from_snarkjs(&env, &raw_proof);
    let signals = public_signals(&env, &public);
    env.ledger()
        .set_timestamp(public[12].parse::<u64>().unwrap());

    let issuer = Address::generate(&env);
    compliance.register_issuer(
        &issuer,
        &field_decimal_to_bytes32(&env, &public[0]),
        &field_decimal_to_bytes32(&env, &public[10]),
        &field_decimal_to_bytes32(&env, &public[11]),
    );
    compliance.register_corridor(
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
        sac.approve(&sender, &compliance_id, &amount, &0);
    }

    (
        env,
        compliance_id,
        ComplianceFixture {
            proof,
            public: signals,
            public_decimal: public,
            input: fixture,
            issuer,
            sender,
            recipient,
            asset,
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

fn init_compliance(env: &Env) -> (Address, Address, Address) {
    let verifier_id = env.register(Groth16Verifier, ());
    let vk_hash = ExternalGroth16VerifierClient::new(env, &verifier_id).vk_hash();
    let admin = Address::generate(env);
    let compliance_id = env.register(Compliance, ());
    ComplianceClient::new(env, &compliance_id).initialize(&admin, &verifier_id, &vk_hash);
    (compliance_id, verifier_id, admin)
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
    );
    let signals = public_signals(&env, &public);
    assert!(public_inputs_match(&expected, &signals));
}

#[test]
fn address_limb_order_matches_circuit_schema() {
    let env = Env::default();
    let bytes = [
        0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee,
        0xff, 0x10, 0x32, 0x54, 0x76, 0x98, 0xba, 0xdc, 0xfe, 0xef, 0xcd, 0xab, 0x89, 0x67, 0x45,
        0x23, 0x01,
    ];
    let addr = contract_address(&env, bytes);
    let (hi_bytes, lo_bytes) = split_address_bytes(&bytes);

    let (lo, hi) = address_to_field_limbs(&env, &addr);

    assert_eq!(lo, bytes16_to_fr(&env, &lo_bytes));
    assert_eq!(hi, bytes16_to_fr(&env, &hi_bytes));
}

#[test]
#[should_panic]
fn verifier_rejects_wrong_public_input_length() {
    let env = Env::default();
    let verifier_id = env.register(Groth16Verifier, ());
    let verifier = ExternalGroth16VerifierClient::new(&env, &verifier_id);
    let (raw_proof, public, _) = load_fixture();
    let proof = external_proof_from_snarkjs(&env, &raw_proof);
    let mut short = Vec::new(&env);
    short.push_back(fr_from_decimal(&env, &public[0]));
    let _ = verifier.verify_proof(&proof, &short);
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
#[should_panic(expected = "Error(Contract, #9)")]
fn compliant_transfer_rejects_duplicate_nullifier() {
    let (env, compliance_id, fixture) = setup_compliance_fixture(true);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    let args = transfer_args(&env, &fixture);
    compliance.compliant_transfer(&args, &fixture.proof, &fixture.public);
    compliance.compliant_transfer(&args, &fixture.proof, &fixture.public);
}

#[test]
#[should_panic(expected = "Error(Contract, #13)")]
fn compliant_transfer_rejects_tampered_amount() {
    let (env, compliance_id, fixture) = setup_compliance_fixture(true);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    let mut args = transfer_args(&env, &fixture);
    args.amount += 1;
    compliance.compliant_transfer(&args, &fixture.proof, &fixture.public);
}

#[test]
fn failed_sac_transfer_does_not_burn_nullifier() {
    let (env, compliance_id, fixture) = setup_compliance_fixture(false);
    let compliance = ComplianceClient::new(&env, &compliance_id);

    let args = transfer_args(&env, &fixture);
    assert!(compliance
        .try_compliant_transfer(&args, &fixture.proof, &fixture.public)
        .is_err());
    assert!(!compliance.check_attestation(&args.nullifier));

    let amount: i128 = fixture.public_decimal[9].parse().unwrap();
    let token = TokenClient::new(&env, &fixture.asset);
    let sac = TestSacClient::new(&env, &fixture.asset);
    sac.mint(&fixture.sender, &amount);
    sac.approve(&fixture.sender, &compliance_id, &amount, &0);
    env.ledger()
        .set_timestamp(fixture.public_decimal[12].parse::<u64>().unwrap());
    compliance.compliant_transfer(&args, &fixture.proof, &fixture.public);

    assert!(compliance.check_attestation(&args.nullifier));
    assert_eq!(token.balance(&fixture.sender), 0);
    assert_eq!(token.balance(&fixture.recipient), amount);
}

#[test]
fn compliant_transfer_emits_proof_settled_event() {
    let (env, compliance_id, fixture) = setup_compliance_fixture(true);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    let args = transfer_args(&env, &fixture);
    let before = env
        .events()
        .all()
        .filter_by_contract(&compliance_id)
        .events()
        .len();

    compliance.compliant_transfer(&args, &fixture.proof, &fixture.public);
    assert_eq!(
        env.events()
            .all()
            .filter_by_contract(&compliance_id)
            .events()
            .len(),
        before + 1
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #18)")]
fn compliant_transfer_rejects_when_paused() {
    let (env, compliance_id, fixture) = setup_compliance_fixture(true);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    compliance.set_paused(&true);
    let args = transfer_args(&env, &fixture);
    compliance.compliant_transfer(&args, &fixture.proof, &fixture.public);
}

#[test]
fn admin_can_pause_and_unpause() {
    let (env, compliance_id, fixture) = setup_compliance_fixture(true);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    let args = transfer_args(&env, &fixture);

    compliance.set_paused(&true);
    assert!(compliance
        .try_compliant_transfer(&args, &fixture.proof, &fixture.public)
        .is_err());

    compliance.set_paused(&false);
    compliance.compliant_transfer(&args, &fixture.proof, &fixture.public);
}

#[test]
#[should_panic]
fn set_paused_requires_admin_auth() {
    let env = Env::default();
    env.mock_all_auths();
    let (compliance_id, _, _) = init_compliance(&env);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    env.set_auths(&[]);

    compliance.set_paused(&true);
}

#[test]
fn pending_admin_must_accept_before_old_admin_loses_rights() {
    let env = Env::default();
    env.mock_all_auths();
    let (compliance_id, _, old_admin) = init_compliance(&env);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    let new_admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let zeros = BytesN::from_array(&env, &[0u8; 32]);

    compliance.propose_admin(&new_admin);
    compliance.register_issuer(&issuer, &zeros, &zeros, &zeros);
    compliance.accept_admin();

    env.set_auths(&[]);
    env.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &old_admin,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &compliance_id,
            fn_name: "set_paused",
            args: (true,).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    assert!(compliance.try_set_paused(&true).is_err());
}

#[test]
#[should_panic(expected = "Error(Contract, #19)")]
fn accept_admin_requires_pending_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let (compliance_id, _, _) = init_compliance(&env);
    let compliance = ComplianceClient::new(&env, &compliance_id);

    compliance.accept_admin();
}

#[test]
#[should_panic(expected = "Error(Contract, #13)")]
fn compliant_transfer_rejects_tampered_recipient() {
    let (env, compliance_id, fixture) = setup_compliance_fixture(true);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    let mut args = transfer_args(&env, &fixture);
    args.recipient = Address::generate(&env);
    compliance.compliant_transfer(&args, &fixture.proof, &fixture.public);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn compliant_transfer_rejects_unknown_corridor() {
    let (env, compliance_id, fixture) = setup_compliance_fixture(true);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    let mut args = transfer_args(&env, &fixture);
    args.corridor_id = 99;
    compliance.compliant_transfer(&args, &fixture.proof, &fixture.public);
}

#[test]
#[should_panic(expected = "Error(Contract, #13)")]
fn compliant_transfer_rejects_mismatched_corridor_public_input() {
    let (env, compliance_id, fixture) = setup_compliance_fixture(true);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    let args = transfer_args(&env, &fixture);
    let mut public = fixture.public.clone();
    public.set(13, fr_from_decimal(&env, "99"));
    compliance.compliant_transfer(&args, &fixture.proof, &public);
}

#[test]
#[should_panic(expected = "Error(Contract, #13)")]
fn compliant_transfer_rejects_stale_merkle_root() {
    let env = Env::default();
    env.ledger().set_timestamp(1_779_840_000);
    env.mock_all_auths();

    let (compliance_id, _, _) = init_compliance(&env);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    let (raw_proof, public, fixture) = load_fixture();
    let proof = proof_from_snarkjs(&env, &raw_proof);
    let signals = public_signals(&env, &public);
    env.ledger()
        .set_timestamp(public[12].parse::<u64>().unwrap());

    let issuer = Address::generate(&env);
    let wrong_root = BytesN::from_array(&env, &[0xAB; 32]);
    compliance.register_issuer(
        &issuer,
        &wrong_root,
        &field_decimal_to_bytes32(&env, &fixture.sanctions_root),
        &field_decimal_to_bytes32(&env, &fixture.jurisdiction_root),
    );
    compliance.register_corridor(
        &fixture.corridor_id.parse().unwrap(),
        &field_decimal_to_bytes32(&env, &fixture.source_jurisdiction_root),
        &field_decimal_to_bytes32(&env, &fixture.dest_address_root),
        &field_decimal_to_bytes32(&env, &fixture.corridor_config_hash),
    );

    let asset = contract_address(&env, DEMO_ASSET);
    env.register_at(&asset, TestSac, ());
    let sac = TestSacClient::new(&env, &asset);
    let sender = contract_address(&env, DEMO_SENDER);
    let amount: i128 = public[9].parse().unwrap();
    sac.mint(&sender, &amount);
    sac.approve(&sender, &compliance_id, &amount, &0);

    let fixture = ComplianceFixture {
        proof,
        public: signals,
        public_decimal: public,
        input: fixture,
        issuer,
        sender,
        recipient: contract_address(&env, DEMO_RECIPIENT),
        asset,
    };
    let args = transfer_args(&env, &fixture);
    compliance.compliant_transfer(&args, &fixture.proof, &fixture.public);
}

#[test]
#[should_panic(expected = "Error(Contract, #14)")]
fn compliant_transfer_rejects_invalid_proof() {
    let (env, compliance_id, fixture) = setup_compliance_fixture(true);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    let (raw_proof, _, _) = load_fixture();
    let bad_proof = tampered_proof(&env, &raw_proof);
    let args = transfer_args(&env, &fixture);
    compliance.compliant_transfer(&args, &bad_proof, &fixture.public);
}

#[test]
#[should_panic]
fn register_issuer_requires_admin_auth() {
    let env = Env::default();
    env.mock_all_auths();
    let (compliance_id, _, _) = init_compliance(&env);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    env.set_auths(&[]);

    let issuer = Address::generate(&env);
    let zeros = BytesN::from_array(&env, &[0u8; 32]);
    compliance.register_issuer(&issuer, &zeros, &zeros, &zeros);
}

#[test]
#[should_panic]
fn register_corridor_requires_admin_auth() {
    let env = Env::default();
    env.mock_all_auths();
    let (compliance_id, _, _) = init_compliance(&env);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    env.set_auths(&[]);

    let zeros = BytesN::from_array(&env, &[0u8; 32]);
    compliance.register_corridor(&1, &zeros, &zeros, &zeros);
}

#[test]
#[should_panic(expected = "Error(Contract, #17)")]
fn compliant_transfer_rejects_stale_epoch() {
    let (env, compliance_id, fixture) = setup_compliance_fixture(true);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    let mut args = transfer_args(&env, &fixture);
    args.epoch = 0;
    compliance.compliant_transfer(&args, &fixture.proof, &fixture.public);
}

#[test]
#[should_panic(expected = "Error(Contract, #16)")]
fn compliant_transfer_rejects_future_epoch() {
    let (env, compliance_id, fixture) = setup_compliance_fixture(true);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    let mut args = transfer_args(&env, &fixture);
    args.epoch = 999_999_999;
    compliance.compliant_transfer(&args, &fixture.proof, &fixture.public);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn compliant_transfer_rejects_disabled_issuer() {
    let (env, compliance_id, fixture) = setup_compliance_fixture(true);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    compliance.set_issuer_enabled(&fixture.issuer, &false);
    let args = transfer_args(&env, &fixture);
    compliance.compliant_transfer(&args, &fixture.proof, &fixture.public);
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn compliant_transfer_rejects_zero_amount() {
    let (env, compliance_id, fixture) = setup_compliance_fixture(true);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    let mut args = transfer_args(&env, &fixture);
    args.amount = 0;
    compliance.compliant_transfer(&args, &fixture.proof, &fixture.public);
}

#[test]
fn update_issuer_root_allows_issuer_auth() {
    let env = Env::default();
    env.mock_all_auths();
    let (compliance_id, _, _) = init_compliance(&env);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    let issuer = Address::generate(&env);
    let zeros = BytesN::from_array(&env, &[0u8; 32]);
    compliance.register_issuer(&issuer, &zeros, &zeros, &zeros);

    let new_root = BytesN::from_array(&env, &[0xBB; 32]);
    env.set_auths(&[]);
    env.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &issuer,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &compliance_id,
            fn_name: "update_issuer_root",
            args: (
                issuer.clone(),
                new_root.clone(),
                zeros.clone(),
                zeros.clone(),
                issuer.clone(),
            )
                .into_val(&env),
            sub_invokes: &[],
        },
    }]);
    compliance.update_issuer_root(&issuer, &new_root, &zeros, &zeros, &issuer);
}

#[test]
fn update_issuer_root_allows_admin_auth() {
    let env = Env::default();
    env.mock_all_auths();
    let (compliance_id, _, admin) = init_compliance(&env);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    let issuer = Address::generate(&env);
    let zeros = BytesN::from_array(&env, &[0u8; 32]);
    compliance.register_issuer(&issuer, &zeros, &zeros, &zeros);

    let new_root = BytesN::from_array(&env, &[0xCC; 32]);
    env.set_auths(&[]);
    env.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &admin,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &compliance_id,
            fn_name: "update_issuer_root",
            args: (
                issuer.clone(),
                new_root.clone(),
                zeros.clone(),
                zeros.clone(),
                admin.clone(),
            )
                .into_val(&env),
            sub_invokes: &[],
        },
    }]);
    compliance.update_issuer_root(&issuer, &new_root, &zeros, &zeros, &admin);
}

#[test]
fn update_issuer_root_rejects_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();
    let (compliance_id, _, _) = init_compliance(&env);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    let issuer = Address::generate(&env);
    let stranger = Address::generate(&env);
    let zeros = BytesN::from_array(&env, &[0u8; 32]);
    compliance.register_issuer(&issuer, &zeros, &zeros, &zeros);

    let new_root = BytesN::from_array(&env, &[0xDD; 32]);
    env.set_auths(&[]);
    env.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &stranger,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &compliance_id,
            fn_name: "update_issuer_root",
            args: (
                issuer.clone(),
                new_root.clone(),
                zeros.clone(),
                zeros.clone(),
                stranger.clone(),
            )
                .into_val(&env),
            sub_invokes: &[],
        },
    }]);
    assert!(compliance
        .try_update_issuer_root(&issuer, &new_root, &zeros, &zeros, &stranger)
        .is_err());
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn compliant_transfer_rejects_disabled_corridor() {
    let (env, compliance_id, fixture) = setup_compliance_fixture(true);
    let compliance = ComplianceClient::new(&env, &compliance_id);
    compliance.update_corridor(
        &fixture.input.corridor_id.parse().unwrap(),
        &field_decimal_to_bytes32(&env, &fixture.input.source_jurisdiction_root),
        &field_decimal_to_bytes32(&env, &fixture.input.dest_address_root),
        &field_decimal_to_bytes32(&env, &fixture.input.corridor_config_hash),
        &false,
    );
    let args = transfer_args(&env, &fixture);
    compliance.compliant_transfer(&args, &fixture.proof, &fixture.public);
}

#[test]
#[should_panic(expected = "direct transfer blocked")]
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
    sac.transfer(&from, &to, &100);
}
