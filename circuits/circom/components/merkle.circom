pragma circom 2.0.0;

include "poseidon2.circom";

template MerklePath() {
  var MERKLE_DEPTH = 20;
  signal input leaf;
  signal input path[MERKLE_DEPTH];
  signal input path_indices[MERKLE_DEPTH];
  signal output root;
  signal cur[MERKLE_DEPTH + 1];
  component h[MERKLE_DEPTH];
  for (var i = 0; i < MERKLE_DEPTH; i++) {
    h[i] = Poseidon2Hash2();
  }
  cur[0] <== leaf;
  for (var i = 0; i < MERKLE_DEPTH; i++) {
    path_indices[i] * (1 - path_indices[i]) === 0;
    h[i].a <== cur[i] + (path[i] - cur[i]) * path_indices[i];
    h[i].b <== path[i] + (cur[i] - path[i]) * path_indices[i];
    cur[i+1] <== h[i].out;
  }
  root <== cur[MERKLE_DEPTH];
}
