import { F, mod, toString } from "./field.js";
import type { FieldElement } from "./types.js";
import { poseidon2Hash2 } from "./poseidon2.js";

export const MERKLE_DEPTH = 20;

export function hash2(a: FieldElement, b: FieldElement): FieldElement {
  return poseidon2Hash2(a, b);
}

export function computeZeroHashes(depth = MERKLE_DEPTH): FieldElement[] {
  const zeros: FieldElement[] = [mod(0)];
  for (let i = 0; i < depth; i++) {
    zeros.push(hash2(zeros[i], zeros[i]));
  }
  return zeros;
}

export function merkleRootFromPath(
  leaf: FieldElement,
  path: FieldElement[],
  pathIndices: number[],
): FieldElement {
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

export function getMerklePathForIndex(
  index: number,
  depth = MERKLE_DEPTH,
): { path: FieldElement[]; pathIndices: number[] } {
  const zeros = computeZeroHashes(depth);
  const path: FieldElement[] = [];
  const pathIndices: number[] = [];
  let idx = index;
  for (let d = 0; d < depth; d++) {
    path.push(zeros[d]);
    pathIndices.push(idx & 1);
    idx >>= 1;
  }
  return { path, pathIndices };
}

export function merkleRootForLeafAtIndex(
  leaf: FieldElement,
  index: number,
  depth = MERKLE_DEPTH,
): FieldElement {
  const { path, pathIndices } = getMerklePathForIndex(index, depth);
  return merkleRootFromPath(leaf, path, pathIndices);
}

export function fieldToBigInt(v: FieldElement): bigint {
  return BigInt(F.toObject(mod(v)));
}

export function sparseSanctionsPath(
  senderLo: FieldElement,
  senderHi: FieldElement,
  depth = MERKLE_DEPTH,
): { path: FieldElement[]; pathIndices: number[]; root: FieldElement } {
  const senderLeaf = hash2(senderLo, senderHi);
  const leafBig = fieldToBigInt(senderLeaf);
  const path: FieldElement[] = [];
  const pathIndices: number[] = [];
  const zeros = computeZeroHashes(depth);
  for (let i = 0; i < depth; i++) {
    pathIndices.push(Number((leafBig >> BigInt(i)) & 1n));
    path.push(zeros[i]);
  }
  return { path, pathIndices, root: zeros[depth] };
}

export function fieldToJson(v: FieldElement): string {
  return toString(v);
}

export function fieldsToJson(arr: FieldElement[]): string[] {
  return arr.map((v) => fieldToJson(v));
}
