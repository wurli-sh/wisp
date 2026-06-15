import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mod, toString } from "../lib/field.mjs";
import { poseidon2Hash1, poseidon2Hash2, poseidon2Hash10, poseidon2Hash11 } from "../lib/poseidon2.mjs";
import {
  MERKLE_DEPTH,
  fieldToJson,
  fieldsToJson,
  getMerklePathForIndex,
  merkleRootForLeafAtIndex,
  sparseSanctionsPath,
} from "../lib/merkle.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUTS_DIR = path.join(__dirname, "..", "inputs");

export const EPOCH_LEN_SECS = 86400;
export const CORRIDOR_ID = 1;

// Domain tags must match compliance_corridor.circom Poseidon2Hash1 inputs.
export const NULLIFIER_DOMAIN_TAG = 1204609112206068373041n;
export const CORRIDOR_DOMAIN_TAG = 0x414d4f4542415f5631n;

// Demo 32-byte identities (fake StrKey payloads, not real accounts)
export const DEMO = {
  credential_secret: 424242n,
  sender: Buffer.from(
    "00112233445566778899aabbccddeeff1032547698badcfeefcdab8967452301",
    "hex",
  ),
  recipient: Buffer.from(
    "102132435465768798a9babbdcedfe0f0f1e2d3c4b5a69788796a5b4c3d2e1f0",
    "hex",
  ),
  asset: Buffer.from(
    "ffeeddccbbaa998877665544332211000123456789abcdeffedcba9876543210",
    "hex",
  ),
  amount: 10_000_000n,
  epoch: 20600n,
  jurisdiction: 840n, // US ISO numeric
  credential_expiry: 2000000000n,
};

export function addressToLimbs(bytes32) {
  const hi = BigInt("0x" + bytes32.subarray(0, 16).toString("hex"));
  const lo = BigInt("0x" + bytes32.subarray(16, 32).toString("hex"));
  return { lo: mod(lo), hi: mod(hi) };
}

export function computeCorridorConfigHash({
  corridorId,
  sourceJurisdictionRoot,
  destAddressRoot,
  enabled = 1n,
  travelRuleThreshold = 0n,
}) {
  // AMOEBA_CORRIDOR_V1 domain via fixed label field
  const label = poseidon2Hash1(mod(CORRIDOR_DOMAIN_TAG));
  return poseidon2Hash10([
    label,
    mod(corridorId),
    mod(sourceJurisdictionRoot),
    mod(destAddressRoot),
    mod(travelRuleThreshold),
    mod(enabled),
    mod(0),
    mod(0),
    mod(0),
    mod(0),
  ]);
}

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

  const nullifier_domain = poseidon2Hash1(mod(NULLIFIER_DOMAIN_TAG));
  const nullifier = poseidon2Hash11([
    nullifier_domain,
    d.credential_secret,
    senderLimbs.lo,
    senderLimbs.hi,
    assetLimbs.lo,
    assetLimbs.hi,
    d.epoch,
    recipientLimbs.lo,
    recipientLimbs.hi,
    d.amount,
    corridorId,
  ]);

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
      sanctions_leaf_value: 1n, // will fail circuit - use for negative test doc only
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
      // Sanctioned fixture requires non-zero leaf - circuit enforces zero
      const w = buildWitnessInput({});
      w.sanctions_leaf_value = "1";
      fs.mkdirSync(INPUTS_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(INPUTS_DIR, `${name}.json`),
        JSON.stringify(w, null, 2) + "\n"
      );
      console.log("wrote", name);
      continue;
    }
    const p = writeFixture(name, overrides);
    console.log("wrote", p);
  }
}
