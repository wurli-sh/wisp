use amoeba_crypto::{
    address_to_limbs, compute_corridor_config_hash, compute_nullifier, fr_to_canonical_decimal,
    get_merkle_path_for_index, merkle_root_for_leaf_at_index, mod_u128, mod_u64, poseidon2_hash1,
    poseidon2_hash2, sparse_sanctions_path, MERKLE_DEPTH,
};
use amoeba_types::public_inputs_from_roots;
use amoeba_types::{
    Credential, DemoTransferFixture, MerklePaths, ProofPackage, Roots, TransferParams,
    WitnessPrivate, EPOCH_LEN_SECS,
};
use ark_bn254::Fr;

pub fn hex_to_bytes(hex: &str) -> Vec<u8> {
    (0..hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).expect("hex"))
        .collect()
}

pub fn build_demo_proof_package(demo: &DemoTransferFixture) -> ProofPackage {
    let sender = hex_to_bytes(&demo.sender_hex);
    let recipient = hex_to_bytes(&demo.recipient_hex);
    let asset = hex_to_bytes(&demo.asset_hex);

    let sender_limbs = address_to_limbs(&sender);
    let recipient_limbs = address_to_limbs(&recipient);
    let asset_limbs = address_to_limbs(&asset);

    let epoch: u64 = demo.epoch.parse().expect("epoch");
    let amount: i128 = demo.amount.parse().expect("amount");
    let jurisdiction: u128 = demo.jurisdiction.parse().expect("jurisdiction");
    let credential_secret: u128 = demo.credential_secret.parse().expect("secret");
    let credential_expiry: u64 = demo.credential_expiry.parse().expect("expiry");
    let corridor_id = demo.corridor_id;

    let sender_leaf = poseidon2_hash2(sender_limbs.lo, sender_limbs.hi);
    let membership = get_merkle_path_for_index(0, MERKLE_DEPTH);
    let merkle_root = merkle_root_for_leaf_at_index(sender_leaf, 0, MERKLE_DEPTH);

    let jurisdiction_leaf = poseidon2_hash1(mod_u128(jurisdiction));
    let jurisdiction_path = get_merkle_path_for_index(0, MERKLE_DEPTH);
    let jurisdiction_root = merkle_root_for_leaf_at_index(jurisdiction_leaf, 0, MERKLE_DEPTH);

    let source_path = get_merkle_path_for_index(0, MERKLE_DEPTH);
    let source_jurisdiction_root = jurisdiction_root;

    let dest_leaf = poseidon2_hash2(recipient_limbs.lo, recipient_limbs.hi);
    let dest_path = get_merkle_path_for_index(0, MERKLE_DEPTH);
    let dest_address_root = merkle_root_for_leaf_at_index(dest_leaf, 0, MERKLE_DEPTH);

    let sanctions = sparse_sanctions_path(sender_limbs.lo, sender_limbs.hi, MERKLE_DEPTH);

    let nullifier = compute_nullifier(
        mod_u128(credential_secret),
        sender_limbs.lo,
        sender_limbs.hi,
        asset_limbs.lo,
        asset_limbs.hi,
        mod_u64(epoch),
        recipient_limbs.lo,
        recipient_limbs.hi,
        mod_u64(amount as u64),
        mod_u64(corridor_id as u64),
    );

    let corridor_config_hash = compute_corridor_config_hash(
        mod_u64(corridor_id as u64),
        source_jurisdiction_root,
        dest_address_root,
        mod_u64(1),
        mod_u64(0),
    );

    let public_input_values = public_inputs_from_roots(
        merkle_root,
        nullifier,
        asset_limbs.lo,
        asset_limbs.hi,
        sender_limbs.lo,
        sender_limbs.hi,
        epoch,
        recipient_limbs.lo,
        recipient_limbs.hi,
        amount,
        sanctions.root,
        jurisdiction_root,
        epoch * EPOCH_LEN_SECS,
        corridor_id,
        corridor_config_hash,
        source_jurisdiction_root,
        dest_address_root,
    );

    let public_inputs: std::collections::HashMap<String, String> =
        amoeba_types::PUBLIC_INPUT_FIELDS
            .iter()
            .zip(public_input_values.iter())
            .map(|(name, value)| (name.to_string(), value.clone()))
            .collect();

    let fr_vec =
        |path: &[Fr]| -> Vec<String> { path.iter().map(|f| fr_to_canonical_decimal(*f)).collect() };

    ProofPackage {
        credential: Credential {
            wallet: demo.sender_hex.clone(),
            jurisdiction: "US".into(),
            credential_expiry,
            sanctions_clear: true,
            corridor_eligibility: vec![corridor_id],
            credential_commitment: None,
        },
        transfer: TransferParams {
            asset: demo.asset_hex.clone(),
            sender: demo.sender_hex.clone(),
            recipient: demo.recipient_hex.clone(),
            amount: demo.amount.clone(),
            corridor_id,
            epoch,
            timestamp: epoch * EPOCH_LEN_SECS,
        },
        roots: Roots {
            merkle_root: fr_to_canonical_decimal(merkle_root),
            sanctions_root: fr_to_canonical_decimal(sanctions.root),
            jurisdiction_root: fr_to_canonical_decimal(jurisdiction_root),
            source_jurisdiction_root: fr_to_canonical_decimal(source_jurisdiction_root),
            dest_address_root: fr_to_canonical_decimal(dest_address_root),
            corridor_config_hash: fr_to_canonical_decimal(corridor_config_hash),
        },
        paths: MerklePaths {
            membership: fr_vec(&membership.path),
            membership_indices: membership.path_indices,
            sanctions: fr_vec(&sanctions.path),
            sanctions_indices: sanctions.path_indices,
            jurisdiction: fr_vec(&jurisdiction_path.path),
            jurisdiction_indices: jurisdiction_path.path_indices,
            source_jurisdiction: fr_vec(&source_path.path),
            source_jurisdiction_indices: source_path.path_indices,
            dest_address: fr_vec(&dest_path.path),
            dest_address_indices: dest_path.path_indices,
        },
        witness_private: Some(WitnessPrivate {
            demo_unsafe: true,
            credential_secret: demo.credential_secret.clone(),
            jurisdiction: demo.jurisdiction.clone(),
            credential_expiry: demo.credential_expiry.clone(),
            sanctions_leaf_value: "0".into(),
        }),
        public_inputs: Some(public_inputs),
    }
}
