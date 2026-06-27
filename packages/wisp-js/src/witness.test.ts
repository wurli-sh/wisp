import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildWitnessInput,
  demoFromFixture,
  proofPackageToWitnessInput,
} from "./witness.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..", "..");
const FIXTURES = path.join(ROOT, "bindings", "fixtures");
const INPUTS = path.join(ROOT, "circuits", "circom", "inputs");

const BN254_R =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function normalize(decimal: string): string {
  let n = BigInt(decimal);
  n = ((n % BN254_R) + BN254_R) % BN254_R;
  return n.toString();
}

const demoTransfer = JSON.parse(
  fs.readFileSync(path.join(FIXTURES, "demo-transfer.json"), "utf8"),
);
const demo = demoFromFixture(demoTransfer);
const witness = buildWitnessInput(demo, {}, { CORRIDOR_ID: 1n, EPOCH_LEN_SECS: 86400 });

const goldenPath = path.join(INPUTS, "valid.us-mx.json");
if (fs.existsSync(goldenPath)) {
  const golden = JSON.parse(fs.readFileSync(goldenPath, "utf8"));
  for (const key of Object.keys(golden)) {
    if (key.endsWith("_indices")) {
      assert.deepEqual(witness[key], golden[key], key);
    } else if (typeof golden[key] === "string" && /^-?\d+$/.test(golden[key])) {
      assert.equal(
        normalize(String(witness[key])),
        normalize(String(golden[key])),
        key,
      );
    } else {
      assert.deepEqual(witness[key], golden[key], key);
    }
  }
  console.log("witness matches valid.us-mx.json");
}

const pkg = {
  credential: {
    wallet: demoTransfer.sender_hex,
    jurisdiction: "US",
    jurisdiction_code: 840,
  },
  transfer: {
    asset: demoTransfer.asset_hex,
    sender: demoTransfer.sender_hex,
    recipient: demoTransfer.recipient_hex,
    amount: demoTransfer.amount,
    corridor_id: demoTransfer.corridor_id,
    epoch: Number(demoTransfer.epoch),
    timestamp: Number(demoTransfer.epoch) * 86400,
  },
  roots: {
    merkle_root: witness.merkle_root,
    sanctions_root: witness.sanctions_root,
    jurisdiction_root: witness.jurisdiction_root,
    source_jurisdiction_root: witness.source_jurisdiction_root,
    dest_address_root: witness.dest_address_root,
    corridor_config_hash: witness.corridor_config_hash,
  },
  paths: {
    membership: witness.path,
    membership_indices: witness.path_indices,
    sanctions: witness.sanctions_path,
    sanctions_indices: witness.sanctions_path_indices,
    jurisdiction: witness.jurisdiction_path,
    jurisdiction_indices: witness.jurisdiction_path_indices,
    source_jurisdiction: witness.source_jurisdiction_path,
    source_jurisdiction_indices: witness.source_jurisdiction_path_indices,
    dest_address: witness.dest_address_path,
    dest_address_indices: witness.dest_address_path_indices,
  },
  witness_private: {
    demo_unsafe: true,
    transfer_nonce: demoTransfer.transfer_nonce ?? "0",
    jurisdiction: demoTransfer.jurisdiction,
    credential_expiry: demoTransfer.credential_expiry,
    sanctions_leaf_value: "0",
  },
  public_inputs: Object.fromEntries(
    [
      "merkle_root",
      "nullifier",
      "asset_lo",
      "asset_hi",
      "sender_lo",
      "sender_hi",
      "epoch",
      "recipient_lo",
      "recipient_hi",
      "amount",
      "sanctions_root",
      "jurisdiction_root",
      "timestamp",
      "corridor_id",
      "corridor_config_hash",
      "source_jurisdiction_root",
      "dest_address_root",
      "issuer_lo",
      "issuer_hi",
    ].map((k) => [k, String(witness[k])]),
  ),
};

const roundTrip = proofPackageToWitnessInput(pkg, demoTransfer.credential_secret);
for (const key of Object.keys(witness)) {
  if (key.endsWith("_indices")) {
    assert.deepEqual(roundTrip[key], witness[key], `round-trip ${key}`);
  } else if (typeof witness[key] === "string" && /^-?\d+$/.test(witness[key])) {
    assert.equal(
      normalize(String(roundTrip[key])),
      normalize(String(witness[key])),
      `round-trip ${key}`,
    );
  } else {
    assert.deepEqual(roundTrip[key], witness[key], `round-trip ${key}`);
  }
}

console.log("proofPackageToWitnessInput round-trip OK");
