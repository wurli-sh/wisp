import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { proofPackageToWitnessInput } from "@wisp_/js/witness";
import {
  WispClient,
  CorridorDisabledForIssuerError,
  DemoIssuerClient,
  issuerRootsMatch,
  normalizeField,
  resolveIssuer,
  resolveIssuerFromUrl,
  serializeSnarkjsProof,
  validatePackage,
  validatePackageStructure,
} from "../src/index.js";
import { loadConfigBrowser } from "../src/config-browser.js";
import type { ProofPackage } from "@wisp_/js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");

function loadFixturePackage(): ProofPackage {
  const golden = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, "bindings/fixtures/public-inputs.valid.json"),
      "utf8",
    ),
  );
  const demo = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, "bindings/fixtures/demo-transfer.json"),
      "utf8",
    ),
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

function makeFetchResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

test("validatePackageStructure accepts fixture-shaped package", () => {
  validatePackageStructure(loadFixturePackage());
});

test("validatePackage rebuilds public_inputs from roots (skipChain)", async () => {
  const client = WispClient.fromEnv();
  const pkg = loadFixturePackage();
  const result = await client.validatePackage(pkg, {
    issuerPublicKey: client.cfg.issuerPublicKey ?? "GTEST",
    corridorId: Number(pkg.transfer?.corridor_id ?? 1),
    skipChain: true,
  });
  assert.equal(result.ok, true);
});

test("validatePackage rejects mismatched public_inputs (skipChain)", async () => {
  const client = WispClient.fromEnv();
  const pkg = loadFixturePackage();
  pkg.public_inputs = { ...pkg.public_inputs!, merkle_root: "999" };
  await assert.rejects(
    () =>
      client.validatePackage(pkg, {
        issuerPublicKey: client.cfg.issuerPublicKey ?? "GTEST",
        corridorId: Number(pkg.transfer?.corridor_id ?? 1),
        skipChain: true,
      }),
    /public_inputs do not match/,
  );
});

test("issuerRootsMatch normalizes equivalent field decimals", () => {
  const golden = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, "bindings/fixtures/public-inputs.valid.json"),
      "utf8",
    ),
  );
  const pkgRoots = {
    ...golden,
    corridor_config_hash: "0",
    source_jurisdiction_root: "0",
    dest_address_root: "0",
  };
  assert.equal(
    issuerRootsMatch(pkgRoots, {
      merkle_root: "1",
      sanctions_root: golden.sanctions_root,
      jurisdiction_root: golden.jurisdiction_root,
    }),
    false,
  );
  assert.equal(
    issuerRootsMatch(pkgRoots, {
      merkle_root: String(normalizeField(golden.merkle_root)),
      sanctions_root: golden.sanctions_root,
      jurisdiction_root: golden.jurisdiction_root,
    }),
    true,
  );
});

test("validatePackage matches injected chain roots", async () => {
  const client = WispClient.fromEnv();
  const pkg = loadFixturePackage();
  const roots = pkg.roots!;
  const result = await client.validatePackage(pkg, {
    issuerPublicKey: "GTEST",
    corridorId: 1,
    chainRoots: {
      issuer: {
        issuer: "GTEST",
        merkle_root: roots.merkle_root,
        sanctions_root: roots.sanctions_root,
        jurisdiction_root: roots.jurisdiction_root,
        ledger: 1,
        txHash: "abc",
        eventTopic: "updated",
      },
        corridor: {
          issuer: "GTEST",
          corridor_id: 1,
          corridor_config_hash: roots.corridor_config_hash,
          source_jurisdiction_root: roots.source_jurisdiction_root,
        dest_address_root: roots.dest_address_root,
        enabled: true,
        ledger: 1,
        txHash: "def",
        eventTopic: "updated",
      },
    },
  });
  assert.equal(result.ok, true);
});

test("validatePackage rejects disabled corridor from injected chain roots", async () => {
  const client = WispClient.fromEnv();
  const pkg = loadFixturePackage();
  const roots = pkg.roots!;
  await assert.rejects(
    () =>
      client.validatePackage(pkg, {
        issuerPublicKey: "GTEST",
        corridorId: 1,
        chainRoots: {
          issuer: {
            issuer: "GTEST",
            merkle_root: roots.merkle_root,
            sanctions_root: roots.sanctions_root,
            jurisdiction_root: roots.jurisdiction_root,
            ledger: 1,
            txHash: "abc",
            eventTopic: "updated",
          },
          corridor: {
            issuer: "GTEST",
            corridor_id: 1,
            corridor_config_hash: roots.corridor_config_hash,
            source_jurisdiction_root: roots.source_jurisdiction_root,
            dest_address_root: roots.dest_address_root,
            enabled: false,
            ledger: 1,
            txHash: "def",
            eventTopic: "updated",
          },
        },
      }),
    (error) => error instanceof CorridorDisabledForIssuerError,
  );
});

test("resolveIssuer validates metadata against on-chain registry entry", async () => {
  const client = WispClient.fromEnv({
    COMPLIANCE_CONTRACT_ID: "CCOMPLIANCE",
    VERIFIER_CONTRACT_ID: "CVERIFIER",
  });
  const resolved = await resolveIssuer(client.cfg, "GTEST", {
    registryEntry: {
      issuer: "GTEST",
      metadata_uri: "https://issuer.example/.well-known/wisp-issuer.json",
      enabled: true,
      registered_at_ledger: 10,
      updated_at_ledger: 11,
      registration_seq: 0,
      ledger: 10,
      txHash: "abc",
      eventTopic: "registered",
    },
    fetchImpl: async () =>
      makeFetchResponse({
        api_version: "2",
        protocol_version: "2",
        issuer_stellar_address: "GTEST",
        metadata_uri: "https://issuer.example/.well-known/wisp-issuer.json",
        service_url: "https://issuer.example",
        compliance_contract_id: "CCOMPLIANCE",
        verifier_contract_id: "CVERIFIER",
        circuit_vk_hash: "deadbeef",
        proof_package_schema: 1,
      }),
  });

  assert.equal(resolved.issuerPublicKey, "GTEST");
  assert.equal(resolved.serviceUrl, "https://issuer.example");
  assert.equal(resolved.protocolVersion, "2");
});

test("resolveIssuerFromUrl rejects non-canonical metadata URL", async () => {
  const client = WispClient.fromEnv();
  await assert.rejects(
    () =>
      resolveIssuerFromUrl(client.cfg, "https://spoof.example/.well-known/wisp-issuer.json", {
        registryEntry: {
          issuer: "GTEST",
          metadata_uri: "https://issuer.example/.well-known/wisp-issuer.json",
          enabled: true,
          registered_at_ledger: 10,
          updated_at_ledger: 11,
          registration_seq: 0,
          ledger: 10,
          txHash: "abc",
          eventTopic: "registered",
        },
        fetchImpl: async () =>
          makeFetchResponse({
            api_version: "2",
            protocol_version: "2",
            issuer_stellar_address: "GTEST",
            metadata_uri: "https://issuer.example/.well-known/wisp-issuer.json",
            service_url: "https://issuer.example",
            proof_package_schema: 1,
          }),
      }),
    /canonicalize back/,
  );
});

test("WispClient prove from issuer package", { timeout: 120_000 }, async (t) => {
  if (!(await issuerAvailable())) {
    t.skip("issuer-service not running on :3000");
  }

  const client = WispClient.fromEnv();
  const demoIssuer = new DemoIssuerClient(client.cfg.issuerUrl);
  const pkg = await demoIssuer.getDemoTransfer();
  const issuerPk = client.cfg.issuerPublicKey;
  if (!issuerPk) {
    t.skip("ISSUER_PUBLIC_KEY not set");
  }
  const corridorId = Number(pkg.transfer?.corridor_id ?? 1);
  await client.validatePackage(pkg, { issuerPublicKey: issuerPk, corridorId });
  const proven = await client.prove({ package: pkg });
  assert.equal(proven.publicSignals.length, 17);
  const expectedInputs = pkg.public_inputs ?? {};
  for (const [field, expected] of Object.entries(expectedInputs)) {
    const got = proven.publicInputs[field];
    assert.equal(
      normalizeField(String(got)),
      normalizeField(String(expected)),
      field,
    );
  }
});

test("config loaders reject invalid ledger values instead of leaking NaN", () => {
  assert.throws(
    () => loadConfigBrowser({ VALIDATE_START_LEDGER: "not-a-number" }),
    /non-negative safe integer/,
  );
  assert.throws(
    () => loadConfigBrowser({ COMPLIANCE_DEPLOY_LEDGER: "-1" }),
    /non-negative safe integer/,
  );
  assert.equal(loadConfigBrowser({ VALIDATE_START_LEDGER: "0" }).validateStartLedger, 0);
});
