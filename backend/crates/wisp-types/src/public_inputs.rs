use std::collections::HashMap;

use ark_bn254::Fr;
use wisp_crypto::fr_to_canonical_decimal;

/// Normalize a decimal field string to canonical positive mod-BN254 representation.
pub fn normalize_field(decimal: &str) -> String {
    fr_to_canonical_decimal(wisp_crypto::fr_from_decimal(decimal))
}

pub type PublicInputsMap = HashMap<&'static str, String>;

#[allow(clippy::too_many_arguments)]
pub fn public_inputs_from_roots(
    merkle_root: Fr,
    nullifier: Fr,
    asset_lo: Fr,
    asset_hi: Fr,
    sender_lo: Fr,
    sender_hi: Fr,
    epoch: u64,
    recipient_lo: Fr,
    recipient_hi: Fr,
    amount: i128,
    sanctions_root: Fr,
    jurisdiction_root: Fr,
    timestamp: u64,
    corridor_id: u32,
    corridor_config_hash: Fr,
    source_jurisdiction_root: Fr,
    dest_address_root: Fr,
) -> Vec<String> {
    use crate::PUBLIC_INPUT_FIELDS;
    let mut map: HashMap<&str, String> = HashMap::new();
    map.insert("merkle_root", fr_to_canonical_decimal(merkle_root));
    map.insert("nullifier", fr_to_canonical_decimal(nullifier));
    map.insert("asset_lo", fr_to_canonical_decimal(asset_lo));
    map.insert("asset_hi", fr_to_canonical_decimal(asset_hi));
    map.insert("sender_lo", fr_to_canonical_decimal(sender_lo));
    map.insert("sender_hi", fr_to_canonical_decimal(sender_hi));
    map.insert("epoch", epoch.to_string());
    map.insert("recipient_lo", fr_to_canonical_decimal(recipient_lo));
    map.insert("recipient_hi", fr_to_canonical_decimal(recipient_hi));
    map.insert("amount", amount.to_string());
    map.insert("sanctions_root", fr_to_canonical_decimal(sanctions_root));
    map.insert(
        "jurisdiction_root",
        fr_to_canonical_decimal(jurisdiction_root),
    );
    map.insert("timestamp", timestamp.to_string());
    map.insert("corridor_id", corridor_id.to_string());
    map.insert(
        "corridor_config_hash",
        fr_to_canonical_decimal(corridor_config_hash),
    );
    map.insert(
        "source_jurisdiction_root",
        fr_to_canonical_decimal(source_jurisdiction_root),
    );
    map.insert(
        "dest_address_root",
        fr_to_canonical_decimal(dest_address_root),
    );

    PUBLIC_INPUT_FIELDS
        .iter()
        .map(|name| map.get(*name).cloned().expect("missing public input field"))
        .collect()
}

#[cfg(test)]
mod tests {
    use std::fs;

    use serde_json::Value;

    use crate::{PUBLIC_INPUT_COUNT, PUBLIC_INPUT_FIELDS};

    #[test]
    fn public_input_count_matches_storage_constant() {
        assert_eq!(PUBLIC_INPUT_COUNT, 17);
    }

    #[test]
    fn golden_public_inputs_have_all_fields() {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../bindings/fixtures/public-inputs.valid.json"
        );
        let raw = fs::read_to_string(path).expect("read golden");
        let golden: Value = serde_json::from_str(&raw).expect("parse golden");
        for field in PUBLIC_INPUT_FIELDS {
            assert!(golden.get(field).is_some(), "missing {field}");
        }
    }
}
