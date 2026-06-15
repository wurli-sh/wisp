use std::str::FromStr;

use ark_bn254::Fr;
use ark_ff::PrimeField;

pub use ark_bn254::Fr as FieldElement;

/// BN254 scalar field modulus.
pub const BN254_MODULUS: &str =
    "21888242871839275222246405745257275088548364400416034343698204186575808495617";

pub fn mod_fr(value: Fr) -> Fr {
    value
}

pub fn mod_u64(value: u64) -> Fr {
    Fr::from(value)
}

pub fn mod_u128(value: u128) -> Fr {
    Fr::from_str(&value.to_string()).expect("u128 fits in BN254 field")
}

pub fn mod_decimal(s: &str) -> Fr {
    fr_from_decimal(s)
}

pub fn fr_from_decimal(s: &str) -> Fr {
    if let Some(rest) = s.strip_prefix('-') {
        return -Fr::from_str(rest).expect("invalid negative field element");
    }
    Fr::from_str(s).expect("invalid field element")
}

pub fn fr_to_string(value: Fr) -> String {
    value.into_bigint().to_string()
}

pub fn fr_to_canonical_decimal(value: Fr) -> String {
    fr_to_string(value)
}

pub fn bytes16_to_fr(bytes: &[u8]) -> Fr {
    assert!(bytes.len() <= 16);
    let mut padded = [0u8; 32];
    let start = 32 - bytes.len();
    padded[start..].copy_from_slice(bytes);
    Fr::from_be_bytes_mod_order(&padded)
}

pub fn bytes32_to_fr(bytes: &[u8; 32]) -> Fr {
    Fr::from_be_bytes_mod_order(bytes)
}

pub fn assert_fr_eq(actual: Fr, expected_decimal: &str) {
    let expected = fr_from_decimal(expected_decimal);
    assert_eq!(
        fr_to_canonical_decimal(actual),
        fr_to_canonical_decimal(expected),
        "expected {expected_decimal}, got {}",
        fr_to_canonical_decimal(actual)
    );
}
