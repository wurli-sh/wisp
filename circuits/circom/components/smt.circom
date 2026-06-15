pragma circom 2.0.0;

include "poseidon2.circom";
include "merkle.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

template SparseMerkleExclusion() {
  var MERKLE_DEPTH = 20;
  signal input wallet_lo;
  signal input wallet_hi;
  signal input path[MERKLE_DEPTH];
  signal input path_indices[MERKLE_DEPTH];
  signal input leaf_value;
  signal output root;

  component leaf_hash = Poseidon2Hash2();
  leaf_hash.a <== wallet_lo;
  leaf_hash.b <== wallet_hi;

  component bits = Num2Bits(254);
  bits.in <== leaf_hash.out;

  for (var i = 0; i < MERKLE_DEPTH; i++) {
    bits.out[i] === path_indices[i];
  }

  component path_check = MerklePath();
  path_check.leaf <== leaf_value;
  for (var i = 0; i < MERKLE_DEPTH; i++) {
    path_check.path[i] <== path[i];
    path_check.path_indices[i] <== path_indices[i];
  }
  root <== path_check.root;

  leaf_value === 0;
}
