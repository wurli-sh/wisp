use ark_bn254::Fr;
use ark_ff::{BigInteger, PrimeField};

use crate::field::{mod_fr, mod_u64};
use crate::poseidon2::poseidon2_hash2;

pub const MERKLE_DEPTH: usize = 20;

pub fn hash2(a: Fr, b: Fr) -> Fr {
    poseidon2_hash2(a, b)
}

pub fn compute_zero_hashes(depth: usize) -> Vec<Fr> {
    let mut zeros = vec![mod_u64(0)];
    for _ in 0..depth {
        let prev = *zeros.last().expect("zero hash seed");
        zeros.push(hash2(prev, prev));
    }
    zeros
}

pub fn merkle_root_from_path(leaf: Fr, path: &[Fr], path_indices: &[u8]) -> Fr {
    let mut cur = mod_fr(leaf);
    for (sibling, &idx) in path.iter().zip(path_indices.iter()) {
        let sibling = mod_fr(*sibling);
        cur = if idx == 0 {
            hash2(cur, sibling)
        } else {
            hash2(sibling, cur)
        };
    }
    cur
}

pub struct MerklePath {
    pub path: Vec<Fr>,
    pub path_indices: Vec<u8>,
}

pub fn get_merkle_path_for_index(index: usize, depth: usize) -> MerklePath {
    let zeros = compute_zero_hashes(depth);
    let mut path = Vec::with_capacity(depth);
    let mut path_indices = Vec::with_capacity(depth);
    let mut idx = index;
    for zero in zeros.iter().take(depth) {
        path.push(*zero);
        path_indices.push((idx & 1) as u8);
        idx >>= 1;
    }
    MerklePath { path, path_indices }
}

pub fn merkle_root_for_leaf_at_index(leaf: Fr, index: usize, depth: usize) -> Fr {
    let MerklePath { path, path_indices } = get_merkle_path_for_index(index, depth);
    merkle_root_from_path(leaf, &path, &path_indices)
}

pub struct SparseSanctionsPath {
    pub path: Vec<Fr>,
    pub path_indices: Vec<u8>,
    pub root: Fr,
}

pub fn sparse_sanctions_path(sender_lo: Fr, sender_hi: Fr, depth: usize) -> SparseSanctionsPath {
    let sender_leaf = hash2(sender_lo, sender_hi);
    let leaf_big = sender_leaf.into_bigint();

    let zeros = compute_zero_hashes(depth);
    let mut path = Vec::with_capacity(depth);
    let mut path_indices = Vec::with_capacity(depth);
    for (i, zero) in zeros.iter().take(depth).enumerate() {
        path_indices.push(u8::from(leaf_big.get_bit(i)));
        path.push(*zero);
    }
    SparseSanctionsPath {
        path,
        path_indices,
        root: zeros[depth],
    }
}
