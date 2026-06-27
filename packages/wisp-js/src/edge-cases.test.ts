import assert from "node:assert/strict";
import test from "node:test";
import {
  addressToLimbs,
  getMerklePathForIndex,
  merkleRootFromPath,
  poseidon2Hash10,
  poseidon2Permutation,
  publicInputsVectorToRecord,
  rebuildExpectedPublicInputs,
  strKeyToPayload,
} from "./index.js";

const ACCOUNT = "GAN3SJKZ7GNHVYCFX7Y3XTDIPZJW6PHMRUL7UDAUHMQ7FIUPDKBFARBC";

test("StrKey decoding validates length, alphabet, version, and checksum", () => {
  assert.equal(strKeyToPayload(ACCOUNT).length, 32);
  assert.throws(() => strKeyToPayload(`${ACCOUNT.slice(0, -1)}A`), /checksum mismatch/);
  assert.throws(() => strKeyToPayload(`${ACCOUNT.slice(0, -1)}!`), /canonical base32/);
  assert.throws(() => strKeyToPayload("AAAA"), /too short|checksum|expected a G/);
});

test("address conversion rejects truncation and padding footguns", () => {
  assert.throws(() => addressToLimbs(Buffer.alloc(31)), /exactly 32 bytes/);
  assert.throws(() => addressToLimbs(Buffer.alloc(33)), /exactly 32 bytes/);

  const base = {
    merkleRoot: "1",
    nullifier: "2",
    asset: "00".repeat(32),
    sender: "11".repeat(32),
    recipient: "22".repeat(32),
    amount: "1",
    sanctionsRoot: "3",
    jurisdictionRoot: "4",
    epoch: 1,
    corridorId: 1,
    corridorConfigHash: "5",
    sourceJurisdictionRoot: "6",
    destAddressRoot: "7",
  };
  for (const malformed of ["1", "0x1234", "gg".repeat(32), "", `${ACCOUNT}A`]) {
    assert.throws(
      () => rebuildExpectedPublicInputs({ ...base, sender: malformed }),
      /valid Stellar|checksum/,
      malformed,
    );
  }
});

test("public input arithmetic rejects zero, negative, and malformed amounts", () => {
  const base = {
    merkleRoot: "1",
    nullifier: "2",
    asset: "00".repeat(32),
    sender: "11".repeat(32),
    recipient: "22".repeat(32),
    amount: "1",
    sanctionsRoot: "3",
    jurisdictionRoot: "4",
    epoch: 1,
    corridorId: 1,
    corridorConfigHash: "5",
    sourceJurisdictionRoot: "6",
    destAddressRoot: "7",
  };
  assert.throws(() => rebuildExpectedPublicInputs({ ...base, amount: "0" }), /greater than zero/);
  assert.throws(() => rebuildExpectedPublicInputs({ ...base, amount: "-1" }), /greater than zero/);
  assert.throws(() => rebuildExpectedPublicInputs({ ...base, amount: "1.5" }), /BigInt/);
  assert.throws(() => publicInputsVectorToRecord([]), /expected 17/);
});

test("Merkle helpers reject invalid depth, index, and path direction", () => {
  assert.throws(() => getMerklePathForIndex(-1), /Merkle index/);
  assert.throws(() => getMerklePathForIndex(2 ** 20), /Merkle index/);
  assert.throws(() => getMerklePathForIndex(0, -1), /Merkle depth/);
  assert.throws(() => merkleRootFromPath(1n, [0n], []), /equal lengths/);
  assert.throws(() => merkleRootFromPath(1n, [0n], [2]), /only 0 or 1/);
});

test("Poseidon APIs fail clearly on wrong arity", () => {
  assert.throws(() => poseidon2Permutation([1n, 2n]), /expects 4/);
  assert.throws(() => poseidon2Hash10(Array(9).fill(0n)), /expects 10/);
});

test("cryptographic helpers remain deterministic under repeated load", () => {
  const expected = getMerklePathForIndex(12345);
  for (let i = 0; i < 250; i += 1) {
    assert.deepEqual(getMerklePathForIndex(12345), expected);
    assert.equal(strKeyToPayload(ACCOUNT).toString("hex"), strKeyToPayload(ACCOUNT).toString("hex"));
  }
});
