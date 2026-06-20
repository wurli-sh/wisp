pragma circom 2.0.0;

include "components/poseidon2.circom";
include "components/merkle.circom";
include "components/smt.circom";
include "node_modules/circomlib/circuits/comparators.circom";

template ComplianceCorridor() {
  var MERKLE_DEPTH = 20;

  // ── Public inputs (17, load-bearing order) ──
  signal input merkle_root;
  signal input nullifier;
  signal input asset_lo;
  signal input asset_hi;
  signal input sender_lo;
  signal input sender_hi;
  signal input epoch;
  signal input recipient_lo;
  signal input recipient_hi;
  signal input amount;
  signal input sanctions_root;
  signal input jurisdiction_root;
  signal input timestamp;
  signal input corridor_id;
  signal input corridor_config_hash;
  signal input source_jurisdiction_root;
  signal input dest_address_root;

  // ── Private inputs ──
  signal input credential_secret;
  signal input path[MERKLE_DEPTH];
  signal input path_indices[MERKLE_DEPTH];
  signal input jurisdiction;
  signal input jurisdiction_path[MERKLE_DEPTH];
  signal input jurisdiction_path_indices[MERKLE_DEPTH];
  signal input credential_expiry;
  signal input source_jurisdiction_path[MERKLE_DEPTH];
  signal input source_jurisdiction_path_indices[MERKLE_DEPTH];
  signal input dest_address_path[MERKLE_DEPTH];
  signal input dest_address_path_indices[MERKLE_DEPTH];
  signal input sanctions_path[MERKLE_DEPTH];
  signal input sanctions_path_indices[MERKLE_DEPTH];
  signal input sanctions_leaf_value;
  signal input transfer_nonce;

  // ── Check 1: Merkle membership ──
  component membership = MerklePath();
  component sender_leaf = Poseidon2Hash2();
  sender_leaf.a <== sender_lo;
  sender_leaf.b <== sender_hi;
  membership.leaf <== sender_leaf.out;
  for (var i = 0; i < MERKLE_DEPTH; i++) {
    membership.path[i] <== path[i];
    membership.path_indices[i] <== path_indices[i];
  }
  merkle_root === membership.root;

  // ── Check 2: Nullifier binding (domain-separated, includes corridor_id) ──
  component nullifier_domain = Poseidon2Hash1();
  nullifier_domain.in <== 24568945153365553; // "WISP_V1" domain tag
  component nullifier_hash = Poseidon2Hash12();
  nullifier_hash.in[0] <== nullifier_domain.out;
  nullifier_hash.in[1] <== credential_secret;
  nullifier_hash.in[2] <== sender_lo;
  nullifier_hash.in[3] <== sender_hi;
  nullifier_hash.in[4] <== asset_lo;
  nullifier_hash.in[5] <== asset_hi;
  nullifier_hash.in[6] <== epoch;
  nullifier_hash.in[7] <== recipient_lo;
  nullifier_hash.in[8] <== recipient_hi;
  nullifier_hash.in[9] <== amount;
  nullifier_hash.in[10] <== corridor_id;
  nullifier_hash.in[11] <== transfer_nonce;
  nullifier === nullifier_hash.out;

  // ── Check 3: Sanctions exclusion ──
  component sanctions = SparseMerkleExclusion();
  sanctions.wallet_lo <== sender_lo;
  sanctions.wallet_hi <== sender_hi;
  for (var i = 0; i < MERKLE_DEPTH; i++) {
    sanctions.path[i] <== sanctions_path[i];
    sanctions.path_indices[i] <== sanctions_path_indices[i];
  }
  sanctions.leaf_value <== sanctions_leaf_value;
  sanctions_root === sanctions.root;

  // ── Check 4: Jurisdiction membership ──
  component jurisdiction_check = MerklePath();
  component jurisdiction_leaf = Poseidon2Hash1();
  jurisdiction_leaf.in <== jurisdiction;
  jurisdiction_check.leaf <== jurisdiction_leaf.out;
  for (var i = 0; i < MERKLE_DEPTH; i++) {
    jurisdiction_check.path[i] <== jurisdiction_path[i];
    jurisdiction_check.path_indices[i] <== jurisdiction_path_indices[i];
  }
  jurisdiction_root === jurisdiction_check.root;

  // ── Check 5: Credential expiry (timestamp <= credential_expiry) ──
  component expiry_check = LessEqThan(64);
  expiry_check.in[0] <== timestamp;
  expiry_check.in[1] <== credential_expiry;
  expiry_check.out === 1;

  // ── Check 6: Corridor source jurisdiction ──
  component source_jurisdiction_check = MerklePath();
  source_jurisdiction_check.leaf <== jurisdiction_leaf.out;
  for (var i = 0; i < MERKLE_DEPTH; i++) {
    source_jurisdiction_check.path[i] <== source_jurisdiction_path[i];
    source_jurisdiction_check.path_indices[i] <== source_jurisdiction_path_indices[i];
  }
  source_jurisdiction_root === source_jurisdiction_check.root;

  // ── Check 7: Corridor destination address ──
  component dest_check = MerklePath();
  component dest_leaf = Poseidon2Hash2();
  dest_leaf.a <== recipient_lo;
  dest_leaf.b <== recipient_hi;
  dest_check.leaf <== dest_leaf.out;
  for (var i = 0; i < MERKLE_DEPTH; i++) {
    dest_check.path[i] <== dest_address_path[i];
    dest_check.path_indices[i] <== dest_address_path_indices[i];
  }
  dest_address_root === dest_check.root;

  // corridor_id, corridor_config_hash, source_jurisdiction_root, and dest_address_root
  // are public inputs. corridor_id is bound via the nullifier; config hash is
  // verified on-chain by the compliance contract against stored corridor config.
}

component main {public [
  merkle_root,
  nullifier,
  asset_lo,
  asset_hi,
  sender_lo,
  sender_hi,
  epoch,
  recipient_lo,
  recipient_hi,
  amount,
  sanctions_root,
  jurisdiction_root,
  timestamp,
  corridor_id,
  corridor_config_hash,
  source_jurisdiction_root,
  dest_address_root
]} = ComplianceCorridor();
