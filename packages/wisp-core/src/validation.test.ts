import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { ProofPackage } from "@wisp_/js";
import { validateProofPackage, validatePackageStructure } from "./index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../../..");

function loadFixturePackage(): ProofPackage {
  const golden = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, "bindings/fixtures/public-inputs.valid.json"),
      "utf8",
    ),
  );
  const demo = JSON.parse(
    fs.readFileSync(path.join(ROOT, "bindings/fixtures/demo-transfer.json"), "utf8"),
  );
  const depth = 20;
  const filler = Array.from({ length: depth }, () => "0");
  const indices = Array.from({ length: depth }, () => 0);
  return {
    schema_version: 1,
    credential: { wallet: demo.sender_hex, jurisdiction: "US", credential_expiry: 2000000000 },
    transfer: {
      asset: demo.asset_hex,
      sender: demo.sender_hex,
      recipient: demo.recipient_hex,
      amount: demo.amount,
      corridor_id: demo.corridor_id,
      epoch: Number(demo.epoch),
      timestamp: Number(demo.epoch) * 86400,
    },
    roots: {
      merkle_root: golden.merkle_root,
      sanctions_root: golden.sanctions_root,
      jurisdiction_root: golden.jurisdiction_root,
      source_jurisdiction_root: golden.source_jurisdiction_root,
      dest_address_root: golden.dest_address_root,
      corridor_config_hash: golden.corridor_config_hash,
    },
    paths: {
      membership: filler,
      membership_indices: indices,
      sanctions: filler,
      sanctions_indices: indices,
      jurisdiction: filler,
      jurisdiction_indices: indices,
      source_jurisdiction: filler,
      source_jurisdiction_indices: indices,
      dest_address: filler,
      dest_address_indices: indices,
    },
    witness_private: {
      credential_secret: demo.credential_secret,
      jurisdiction: demo.jurisdiction,
      credential_expiry: demo.credential_expiry,
    },
    public_inputs: golden,
  };
}

test("validatePackageStructure accepts fixture-shaped package", () => {
  validatePackageStructure(loadFixturePackage());
});

test("validateProofPackage rebuilds public inputs from fixture roots", () => {
  const result = validateProofPackage(loadFixturePackage(), { corridorId: 1 });
  assert.equal(result.ok, true);
  assert.equal(typeof result.publicInputs.nullifier, "string");
});
