import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  addressToLimbs,
  computeCorridorConfigHash,
  computeNullifier,
} from "../../../packages/amoeba-crypto/src/index.mjs";
import {
  fieldToJson,
  fieldsToJson,
  getMerklePathForIndex,
  merkleRootForLeafAtIndex,
  poseidon2Hash1,
  poseidon2Hash2,
  sparseSanctionsPath,
} from "../../../packages/amoeba-crypto/src/index.mjs";
import { PUBLIC_INPUT_FIELDS, PROTOCOL } from "../../../bindings/generated/publicInputs.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUTS_DIR = path.join(__dirname, "..", "inputs");
const FIXTURES_DIR = path.join(__dirname, "..", "..", "..", "bindings", "fixtures");

export const EPOCH_LEN_SECS = PROTOCOL.EPOCH_LEN_SECS;
export const CORRIDOR_ID = PROTOCOL.CORRIDOR_ID;
export const NULLIFIER_DOMAIN_TAG = PROTOCOL.NULLIFIER_DOMAIN_TAG;
export const CORRIDOR_DOMAIN_TAG = PROTOCOL.CORRIDOR_DOMAIN_TAG;

const demoTransfer = JSON.parse(
  fs.readFileSync(path.join(FIXTURES_DIR, "demo-transfer.json"), "utf8"),
);

export const DEMO = {
  credential_secret: BigInt(demoTransfer.credential_secret),
  sender: Buffer.from(demoTransfer.sender_hex, "hex"),
  recipient: Buffer.from(demoTransfer.recipient_hex, "hex"),
  asset: Buffer.from(demoTransfer.asset_hex, "hex"),
  amount: BigInt(demoTransfer.amount),
  epoch: BigInt(demoTransfer.epoch),
  jurisdiction: BigInt(demoTransfer.jurisdiction),
  credential_expiry: BigInt(demoTransfer.credential_expiry),
};

export { addressToLimbs, computeCorridorConfigHash, PUBLIC_INPUT_FIELDS };

export function buildWitnessInput(overrides = {}) {
  const d = { ...DEMO, ...overrides };
  const senderLimbs = addressToLimbs(d.sender);
  const recipientLimbs = addressToLimbs(d.recipient);
  const assetLimbs = addressToLimbs(d.asset);
  const timestamp = d.epoch * BigInt(EPOCH_LEN_SECS);

  const senderLeaf = poseidon2Hash2(senderLimbs.lo, senderLimbs.hi);
  const membershipPath = getMerklePathForIndex(0);
  const merkleRoot = merkleRootForLeafAtIndex(senderLeaf, 0);

  const jurisdictionLeaf = poseidon2Hash1(d.jurisdiction);
  const jurisdictionPath = getMerklePathForIndex(0);
  const jurisdictionRoot = merkleRootForLeafAtIndex(jurisdictionLeaf, 0);

  const sourcePath = getMerklePathForIndex(0);
  const sourceJurisdictionRoot = merkleRootForLeafAtIndex(jurisdictionLeaf, 0);

  const destLeaf = poseidon2Hash2(recipientLimbs.lo, recipientLimbs.hi);
  const destPath = getMerklePathForIndex(0);
  const destAddressRoot = merkleRootForLeafAtIndex(destLeaf, 0);

  const sanctions = sparseSanctionsPath(senderLimbs.lo, senderLimbs.hi);

  const corridorId = d.corridor_id ?? CORRIDOR_ID;

  const nullifier = computeNullifier({
    credentialSecret: d.credential_secret,
    senderLo: senderLimbs.lo,
    senderHi: senderLimbs.hi,
    assetLo: assetLimbs.lo,
    assetHi: assetLimbs.hi,
    epoch: d.epoch,
    recipientLo: recipientLimbs.lo,
    recipientHi: recipientLimbs.hi,
    amount: d.amount,
    corridorId,
  });

  const corridorConfigHash = computeCorridorConfigHash({
    corridorId,
    sourceJurisdictionRoot,
    destAddressRoot,
  });

  return {
    merkle_root: fieldToJson(merkleRoot),
    nullifier: fieldToJson(nullifier),
    asset_lo: fieldToJson(assetLimbs.lo),
    asset_hi: fieldToJson(assetLimbs.hi),
    sender_lo: fieldToJson(senderLimbs.lo),
    sender_hi: fieldToJson(senderLimbs.hi),
    epoch: fieldToJson(d.epoch),
    recipient_lo: fieldToJson(recipientLimbs.lo),
    recipient_hi: fieldToJson(recipientLimbs.hi),
    amount: fieldToJson(d.amount),
    sanctions_root: fieldToJson(sanctions.root),
    jurisdiction_root: fieldToJson(jurisdictionRoot),
    timestamp: fieldToJson(timestamp),
    corridor_id: fieldToJson(corridorId),
    corridor_config_hash: fieldToJson(corridorConfigHash),
    source_jurisdiction_root: fieldToJson(sourceJurisdictionRoot),
    dest_address_root: fieldToJson(destAddressRoot),
    credential_secret: fieldToJson(d.credential_secret),
    path: fieldsToJson(membershipPath.path),
    path_indices: membershipPath.pathIndices,
    jurisdiction: fieldToJson(d.jurisdiction),
    jurisdiction_path: fieldsToJson(jurisdictionPath.path),
    jurisdiction_path_indices: jurisdictionPath.pathIndices,
    credential_expiry: fieldToJson(d.credential_expiry),
    source_jurisdiction_path: fieldsToJson(sourcePath.path),
    source_jurisdiction_path_indices: sourcePath.pathIndices,
    dest_address_path: fieldsToJson(destPath.path),
    dest_address_path_indices: destPath.pathIndices,
    sanctions_path: fieldsToJson(sanctions.path),
    sanctions_path_indices: sanctions.pathIndices,
    sanctions_leaf_value: "0",
  };
}

export function writeFixture(name, overrides = {}) {
  const witness = buildWitnessInput(overrides);
  const outPath = path.join(INPUTS_DIR, `${name}.json`);
  fs.mkdirSync(INPUTS_DIR, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(witness, null, 2) + "\n");
  return outPath;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fixtures = {
    "valid.us-mx": {},
    "invalid.expired": { credential_expiry: 1n },
    "invalid.sanctioned": {
      sanctions_leaf_value: 1n,
    },
  };

  const writeTampered = (name, mutate) => {
    const w = buildWitnessInput({});
    mutate(w);
    fs.mkdirSync(INPUTS_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(INPUTS_DIR, `${name}.json`),
      JSON.stringify(w, null, 2) + "\n",
    );
    console.log("wrote", name);
  };

  writeTampered("invalid.amount", (w) => {
    w.amount = "99999999";
  });
  writeTampered("invalid.recipient", (w) => {
    const recipientLimbs = addressToLimbs(Buffer.from("ff".repeat(32), "hex"));
    w.recipient_lo = fieldToJson(recipientLimbs.lo);
    w.recipient_hi = fieldToJson(recipientLimbs.hi);
  });
  writeTampered("invalid.corridor", (w) => {
    w.corridor_id = fieldToJson(99n);
  });

  for (const [name, overrides] of Object.entries(fixtures)) {
    if (name === "invalid.sanctioned") {
      const w = buildWitnessInput({});
      w.sanctions_leaf_value = "1";
      fs.mkdirSync(INPUTS_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(INPUTS_DIR, `${name}.json`),
        JSON.stringify(w, null, 2) + "\n",
      );
      console.log("wrote", name);
      continue;
    }
    const p = writeFixture(name, overrides);
    console.log("wrote", p);
  }
}
