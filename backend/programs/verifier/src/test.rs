#![cfg(test)]
extern crate std;

use core::str::FromStr;
use std::string::String;

use ark_bn254::{Fq, Fr as ArkFr};
use ark_ff::{BigInteger, PrimeField};
use serde::Deserialize;
use soroban_sdk::{
    crypto::bn254::{
        Bn254G1Affine, Bn254G2Affine, Fr, BN254_G1_SERIALIZED_SIZE, BN254_G2_SERIALIZED_SIZE,
    },
    Bytes, Env, Vec, U256,
};

use crate::{Groth16Verifier, Groth16VerifierClient, Proof};

fn repo_root() -> std::path::PathBuf {
    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../..")
        .canonicalize()
        .expect("repo root")
}

fn bytes_to_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push(HEX[(b >> 4) as usize] as char);
        out.push(HEX[(b & 0xf) as usize] as char);
    }
    out
}

#[derive(Deserialize)]
struct SnarkProof {
    pi_a: [String; 3],
    pi_b: [[String; 2]; 3],
    pi_c: [String; 3],
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

fn fr_from_decimal(env: &Env, s: &str) -> Fr {
    let ark = ArkFr::from_str(s).unwrap();
    let mut padded = [0u8; 32];
    let bytes = ark.into_bigint().to_bytes_be();
    padded[32 - bytes.len()..].copy_from_slice(&bytes);
    Fr::from_u256(U256::from_be_bytes(env, &Bytes::from_array(env, &padded)))
}

#[test]
fn accepts_valid_compliance_fixture() {
    let env = Env::default();
    let verifier_id = env.register(Groth16Verifier, ());
    let verifier = Groth16VerifierClient::new(&env, &verifier_id);

    let raw: SnarkProof = serde_json::from_str(include_str!(
        "../../../../circuits/circom/artifacts/proof.json"
    ))
    .unwrap();
    let public: std::vec::Vec<String> = serde_json::from_str(include_str!(
        "../../../../circuits/circom/artifacts/public.json"
    ))
    .unwrap();

    let proof = proof_from_snarkjs(&env, &raw);
    let mut signals = Vec::new(&env);
    for v in public {
        signals.push_back(fr_from_decimal(&env, &v));
    }

    assert!(verifier.verify_proof(&proof, &signals));
}

#[test]
#[should_panic]
fn rejects_wrong_public_input_length() {
    let env = Env::default();
    let verifier_id = env.register(Groth16Verifier, ());
    let verifier = Groth16VerifierClient::new(&env, &verifier_id);

    let raw: SnarkProof = serde_json::from_str(include_str!(
        "../../../../circuits/circom/artifacts/proof.json"
    ))
    .unwrap();
    let proof = proof_from_snarkjs(&env, &raw);
    let mut short = Vec::new(&env);
    short.push_back(Fr::from_u256(U256::from_u32(&env, 1)));
    let _ = verifier.verify_proof(&proof, &short);
}

#[test]
fn rejects_tampered_proof() {
    let env = Env::default();
    let verifier_id = env.register(Groth16Verifier, ());
    let verifier = Groth16VerifierClient::new(&env, &verifier_id);

    let raw: SnarkProof = serde_json::from_str(include_str!(
        "../../../../circuits/circom/artifacts/proof.json"
    ))
    .unwrap();
    let public: std::vec::Vec<String> = serde_json::from_str(include_str!(
        "../../../../circuits/circom/artifacts/public.json"
    ))
    .unwrap();

    let mut bad = proof_from_snarkjs(&env, &raw);
    bad = Proof {
        a: bad.c.clone(),
        b: bad.b.clone(),
        c: bad.a.clone(),
    };
    let mut signals = Vec::new(&env);
    for v in public {
        signals.push_back(fr_from_decimal(&env, &v));
    }

    assert!(!verifier.verify_proof(&bad, &signals));
}

#[test]
fn vk_hash_matches_compute_vk_hash_script() {
    let env = Env::default();
    let verifier_id = env.register(Groth16Verifier, ());
    let verifier = Groth16VerifierClient::new(&env, &verifier_id);

    let on_chain = bytes_to_hex(&verifier.vk_hash().to_array());

    let script = repo_root().join("circuits/circom/scripts/compute-vk-hash.py");
    let output = std::process::Command::new("python3")
        .arg(&script)
        .output()
        .expect("run compute-vk-hash.py");
    assert!(
        output.status.success(),
        "compute-vk-hash.py failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let expected: String = String::from_utf8(output.stdout)
        .expect("utf8 stdout")
        .trim()
        .into();

    assert_eq!(on_chain, expected);
}
