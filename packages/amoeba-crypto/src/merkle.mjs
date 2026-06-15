import { F, mod, toString } from "./field.mjs";
import { poseidon2Hash2 } from "./poseidon2.mjs";

export const MERKLE_DEPTH = 20;

export function hash2(a, b) {
  return poseidon2Hash2(a, b);
}

export function computeZeroHashes(depth = MERKLE_DEPTH) {
  const zeros = [mod(0)];
  for (let i = 0; i < depth; i++) {
    zeros.push(hash2(zeros[i], zeros[i]));
  }
  return zeros;
}

export function merkleRootFromPath(leaf, path, pathIndices) {
  let cur = mod(leaf);
  for (let i = 0; i < path.length; i++) {
    const sibling = mod(path[i]);
    if (pathIndices[i] === 0) {
      cur = hash2(cur, sibling);
    } else {
      cur = hash2(sibling, cur);
    }
  }
  return cur;
}

export function getMerklePathForIndex(index, depth = MERKLE_DEPTH) {
  const zeros = computeZeroHashes(depth);
  const path = [];
  const pathIndices = [];
  let idx = index;
  for (let d = 0; d < depth; d++) {
    path.push(zeros[d]);
    pathIndices.push(idx & 1);
    idx >>= 1;
  }
  return { path, pathIndices };
}

export function merkleRootForLeafAtIndex(leaf, index, depth = MERKLE_DEPTH) {
  const { path, pathIndices } = getMerklePathForIndex(index, depth);
  return merkleRootFromPath(leaf, path, pathIndices);
}

export function fieldToBigInt(v) {
  return BigInt(F.toObject(mod(v)));
}

export function sparseSanctionsPath(senderLo, senderHi, depth = MERKLE_DEPTH) {
  const senderLeaf = hash2(senderLo, senderHi);
  const leafBig = fieldToBigInt(senderLeaf);
  const path = [];
  const pathIndices = [];
  const zeros = computeZeroHashes(depth);
  for (let i = 0; i < depth; i++) {
    pathIndices.push(Number((leafBig >> BigInt(i)) & 1n));
    path.push(zeros[i]);
  }
  return { path, pathIndices, root: zeros[depth] };
}

export function fieldToJson(v) {
  return toString(v);
}

export function fieldsToJson(arr) {
  return arr.map((v) => fieldToJson(v));
}
