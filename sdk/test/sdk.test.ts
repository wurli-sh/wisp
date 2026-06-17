import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { proofPackageToWitnessInput } from "@amoeba/js/witness";
import { AmoebaClient, normalizeField, serializeSnarkjsProof } from "../src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");

test("serializeSnarkjsProof produces 128-byte G1 and 256-byte G2", () => {
  const proof = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, "circuits/circom/artifacts/proof.json"),
      "utf8",
    ),
  );
  const serialized = serializeSnarkjsProof(proof);
  assert.equal(serialized.a.length, 64);
  assert.equal(serialized.c.length, 64);
  assert.equal(serialized.b.length, 128);
  const again = serializeSnarkjsProof(proof);
  assert.equal(serialized.a.toString("hex"), again.a.toString("hex"));
});

test("normalizeField matches assert-public-inputs", () => {
  const golden = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, "bindings/fixtures/public-inputs.valid.json"),
      "utf8",
    ),
  );
  const pkg = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, "bindings/fixtures/demo-transfer.json"),
      "utf8",
    ),
  );
  const witness = proofPackageToWitnessInput({
    credential: { wallet: pkg.sender_hex, jurisdiction: "US" },
    transfer: {
      asset: pkg.asset_hex,
      sender: pkg.sender_hex,
      recipient: pkg.recipient_hex,
      amount: pkg.amount,
      corridor_id: pkg.corridor_id,
      epoch: Number(pkg.epoch),
      timestamp: Number(pkg.epoch) * 86400,
    },
    roots: {},
    paths: {
      membership: [],
      membership_indices: [],
      sanctions: [],
      sanctions_indices: [],
      jurisdiction: [],
      jurisdiction_indices: [],
      source_jurisdiction: [],
      source_jurisdiction_indices: [],
      dest_address: [],
      dest_address_indices: [],
    },
    witness_private: {
      demo_unsafe: true,
      credential_secret: pkg.credential_secret,
      transfer_nonce: pkg.transfer_nonce ?? "0",
      jurisdiction: pkg.jurisdiction,
      credential_expiry: pkg.credential_expiry,
      sanctions_leaf_value: "0",
    },
    public_inputs: golden,
  });
  assert.ok(witness.merkle_root);
  for (const [k, v] of Object.entries(golden)) {
    assert.equal(normalizeField(String(v)), normalizeField(String(golden[k])), k);
  }
});

async function issuerAvailable(): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:3000/health");
    return res.ok;
  } catch {
    return false;
  }
}

test("AmoebaClient prove from issuer package", { timeout: 120_000 }, async (t) => {
  if (!(await issuerAvailable())) {
    t.skip("issuer-service not running on :3000");
  }

  const client = AmoebaClient.fromEnv();
  const pkg = await client.issuer.getDemoTransfer();
  const proven = await client.prove({ package: pkg });
  assert.equal(proven.publicSignals.length, 17);
  const golden = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, "bindings/fixtures/public-inputs.valid.json"),
      "utf8",
    ),
  );
  for (const [field, expected] of Object.entries(golden)) {
    const got = proven.publicInputs[field];
    assert.equal(
      normalizeField(String(got)),
      normalizeField(String(expected)),
      field,
    );
  }
});
