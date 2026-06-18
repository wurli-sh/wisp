import assert from "node:assert/strict";
import test from "node:test";
import { AmoebaIssuerClient, loadIssuerConfig, normalizeRootHashToBytes, runIssuerConformance } from "../src/index.js";

function fakeTx(label: string, onSend?: () => unknown): {
  label: string;
  signAndSend(args: { signTransaction: (xdr: string) => Promise<{ signedTxXdr: string }> }): Promise<unknown>;
} {
  return {
    label,
    async signAndSend({ signTransaction }) {
      await signTransaction(`${label}-xdr`);
      const result = onSend ? onSend() : undefined;
      return {
        hash: `${label}-hash`,
        get result() {
          return result;
        },
      };
    },
  };
}

function makeClient(log: Array<{ method: string; args: unknown }>, state?: {
  issuerExists?: boolean;
  corridorExists?: boolean;
  registerCorridorSendFails?: boolean;
}) {
  return new AmoebaIssuerClient(
    {
      rpcUrl: "https://rpc.test",
      networkPassphrase: "Test SDF Network ; September 2015",
      complianceId: "C123",
      operatorPublicKey: "GOPERATOR",
      issuerPublicKey: "GISSUER",
    },
    {
      contractFactory: () => ({
        async get_issuer(args) {
          log.push({ method: "get_issuer", args });
          return { result: state?.issuerExists ? { issuer: args.issuer } : null };
        },
        async get_corridor(args) {
          log.push({ method: "get_corridor", args });
          return { result: state?.corridorExists ? { issuer: args.issuer } : null };
        },
        async register_issuer(args) {
          log.push({ method: "register_issuer", args });
          return fakeTx("register_issuer");
        },
        async update_issuer_metadata(args) {
          log.push({ method: "update_issuer_metadata", args });
          return fakeTx("update_issuer_metadata");
        },
        async register_corridor(args) {
          log.push({ method: "register_corridor", args });
          return fakeTx("register_corridor", () => {
            if (state?.registerCorridorSendFails) {
              throw new Error("HostError: Error(Contract, #21)");
            }
            return { hash: "register_corridor-hash" };
          });
        },
        async update_corridor(args) {
          log.push({ method: "update_corridor", args });
          return fakeTx("update_corridor");
        },
        async update_issuer_root(args) {
          log.push({ method: "update_issuer_root", args });
          return fakeTx("update_issuer_root");
        },
      }),
    },
  );
}

test("normalizeRootHashToBytes converts decimal field input to 32 bytes", () => {
  const bytes = normalizeRootHashToBytes("15");
  assert.equal(bytes.length, 32);
  assert.equal(bytes.toString("hex"), "0".repeat(62) + "0f");
});

test("normalizeRootHashToBytes normalizes 32-byte hex input", () => {
  const bytes = normalizeRootHashToBytes("0x" + "ab".repeat(32));
  assert.equal(bytes.toString("hex"), "ab".repeat(32));
});

test("normalizeRootHashToBytes rejects malformed input", () => {
  assert.throws(
    () => normalizeRootHashToBytes("0x1234"),
    /32-byte hex|canonical field decimal/,
  );
});

test("publishRoots plans register + register path for fresh issuer and corridor", async () => {
  const log: Array<{ method: string; args: unknown }> = [];
  const client = makeClient(log);

  const plan = await client.publishRoots({
    corridorId: 7,
    metadataUri: "https://issuer.test/meta.json",
    merkleRoot: "1",
    sanctionsRoot: "2",
    jurisdictionRoot: "3",
    sourceJurisdictionRoot: "4",
    destAddressRoot: "5",
    corridorConfigHash: "6",
  });

  assert.equal("registerIssuer" in plan && Boolean(plan.registerIssuer), true);
  assert.equal("corridor" in plan && plan.corridor.action, "register");
  assert.equal("registerIssuer" in plan && typeof plan.registerIssuer?.build, "function");
  assert.equal(typeof plan.publishIssuerRoots.build, "function");
  assert.equal(typeof plan.corridor.build, "function");
  assert.deepEqual(
    log.map((entry) => entry.method),
    [
      "get_issuer",
      "get_corridor",
    ],
  );
});

test("publishRoots skips issuer register when issuer already exists", async () => {
  const log: Array<{ method: string; args: unknown }> = [];
  const client = makeClient(log, { issuerExists: true });

  const plan = await client.publishRoots({
    corridorId: 7,
    metadataUri: "https://issuer.test/meta.json",
    merkleRoot: "1",
    sanctionsRoot: "2",
    jurisdictionRoot: "3",
    sourceJurisdictionRoot: "4",
    destAddressRoot: "5",
    corridorConfigHash: "6",
  });

  assert.equal("registerIssuer" in plan && plan.registerIssuer, undefined);
  assert.equal(log.some((entry) => entry.method === "register_issuer"), false);
});

test("publishRoots plans corridor update when corridor already exists", async () => {
  const log: Array<{ method: string; args: unknown }> = [];
  const client = makeClient(log, { corridorExists: true });

  const plan = await client.publishRoots({
    corridorId: 7,
    metadataUri: "https://issuer.test/meta.json",
    merkleRoot: "1",
    sanctionsRoot: "2",
    jurisdictionRoot: "3",
    sourceJurisdictionRoot: "4",
    destAddressRoot: "5",
    corridorConfigHash: "6",
  });

  assert.equal("corridor" in plan && plan.corridor.action, "update");
  assert.equal(log.some((entry) => entry.method === "update_corridor"), false);
  assert.equal(typeof plan.corridor.build, "function");
});

test("registerCorridor encodes hashes and send helper uses signer", async () => {
  const log: Array<{ method: string; args: unknown }> = [];
  const client = makeClient(log);
  const signed: string[] = [];

  await client.registerCorridorAndSend(
    {
      corridorId: 9,
      sourceJurisdictionRoot: "10",
      destAddressRoot: "11",
      corridorConfigHash: "12",
    },
    {
      publicKey: "GSIGNER",
      async signTransaction(xdr) {
        signed.push(xdr);
        return { signedTxXdr: xdr };
      },
    },
  );

  const call = log.find((entry) => entry.method === "register_corridor");
  assert.ok(call);
  assert.equal(Buffer.isBuffer((call!.args as { source_jurisdiction_root: unknown }).source_jurisdiction_root), true);
  assert.deepEqual(signed, ["register_corridor-xdr"]);
});

test("normalizeRootHashToBytes treats numeric 64-char input as hex", () => {
  const input = "1".repeat(64);
  const bytes = normalizeRootHashToBytes(input);
  assert.equal(bytes.toString("hex"), input);
});

test("publishRoots send path falls back to updateCorridor when register send hits existing corridor", async () => {
  const log: Array<{ method: string; args: unknown }> = [];
  const client = makeClient(log, { registerCorridorSendFails: true });

  const result = await client.publishRoots(
    {
      corridorId: 7,
      metadataUri: "https://issuer.test/meta.json",
      merkleRoot: "1",
      sanctionsRoot: "2",
      jurisdictionRoot: "3",
      sourceJurisdictionRoot: "4",
      destAddressRoot: "5",
      corridorConfigHash: "6",
    },
    {
      publicKey: "GSIGNER",
      async signTransaction(xdr) {
        return { signedTxXdr: xdr };
      },
    },
  );

  assert.equal("sent" in result, true);
  assert.equal(
    log.filter((entry) => entry.method === "update_corridor").length >= 1,
    true,
  );
});

test("publishRoots send path assembles sequentially after issuer registration", async () => {
  const log: Array<{ method: string; args: unknown }> = [];
  const client = makeClient(log);

  await client.publishRoots(
    {
      corridorId: 7,
      metadataUri: "https://issuer.test/meta.json",
      merkleRoot: "1",
      sanctionsRoot: "2",
      jurisdictionRoot: "3",
      sourceJurisdictionRoot: "4",
      destAddressRoot: "5",
      corridorConfigHash: "6",
    },
    {
      publicKey: "GSIGNER",
      async signTransaction(xdr) {
        return { signedTxXdr: xdr };
      },
    },
  );

  assert.deepEqual(
    log.map((entry) => entry.method),
    [
      "get_issuer",
      "get_corridor",
      "register_issuer",
      "update_issuer_root",
      "register_corridor",
    ],
  );
});

test("registerIssuerAndSend surfaces send failures from sent.result", async () => {
  const log: Array<{ method: string; args: unknown }> = [];
  const client = new AmoebaIssuerClient(
    {
      rpcUrl: "https://rpc.test",
      networkPassphrase: "Test SDF Network ; September 2015",
      complianceId: "C123",
      operatorPublicKey: "GOPERATOR",
      issuerPublicKey: "GISSUER",
    },
    {
      contractFactory: () => ({
        async get_issuer() {
          return { result: null };
        },
        async get_corridor() {
          return { result: null };
        },
        async register_issuer(args) {
          log.push({ method: "register_issuer", args });
          return fakeTx("register_issuer", () => {
            throw new Error("HostError: Error(Contract, #20)");
          });
        },
        async update_issuer_metadata() {
          return fakeTx("update_issuer_metadata");
        },
        async register_corridor() {
          return fakeTx("register_corridor");
        },
        async update_corridor() {
          return fakeTx("update_corridor");
        },
        async update_issuer_root() {
          return fakeTx("update_issuer_root");
        },
      }),
    },
  );

  await assert.rejects(
    () =>
      client.registerIssuerAndSend(
        { metadataUri: "https://issuer.test/meta.json" },
        {
          publicKey: "GSIGNER",
          async signTransaction(xdr) {
            return { signedTxXdr: xdr };
          },
        },
      ),
    /#20/,
  );
});

test("runIssuerConformance happy path", async () => {
  const result = await runIssuerConformance(
    {
      issuerUrl: "https://issuer.test",
      issuerPublicKey: "GISSUER",
      sender: "GSENDER",
      recipient: "GRECIPIENT",
      simulateSettle: true,
      simulationPublicKey: "GSENDER",
    },
    {
      client: {
        issuer: {
          async getWellKnown() {
            return {
              api_version: "1.0",
              issuer_stellar_address: "GISSUER",
              circuit_vk_hash: "vk",
              proof_package_schema: 1,
            };
          },
          async createProofPackage() {
            return {
              transfer: { corridor_id: 1, amount: "10000000" },
              roots: {},
              paths: {},
              public_inputs: { nullifier: "9" },
            } as never;
          },
        },
        async validatePackage() {
          return { ok: true };
        },
        async prove() {
          return {
            nullifier: "9",
            proof: { a: Buffer.alloc(64), b: Buffer.alloc(128), c: Buffer.alloc(64) },
            publicSignals: ["1"],
          };
        },
        async simulateSettle() {
          return { ok: true };
        },
      },
    },
  );

  assert.equal(result.validation.ok, true);
  assert.ok(result.proven);
  assert.deepEqual(result.simulated, { ok: true });
});

test("runIssuerConformance fails when well-known is unavailable", async () => {
  await assert.rejects(
    () =>
      runIssuerConformance(
        {
          issuerUrl: "https://issuer.test",
          issuerPublicKey: "GISSUER",
          sender: "GSENDER",
          recipient: "GRECIPIENT",
        },
        {
          client: {
            issuer: {
              async createProofPackage() {
                return {} as never;
              },
            },
            async validatePackage() {
              return { ok: true };
            },
            async prove() {
              return {} as never;
            },
            async simulateSettle() {
              return {};
            },
          },
        },
      ),
    /issuer adapter missing getWellKnown/,
  );
});

test("runIssuerConformance surfaces invalid proof package validation failures", async () => {
  await assert.rejects(
    () =>
      runIssuerConformance(
        {
          issuerUrl: "https://issuer.test",
          issuerPublicKey: "GISSUER",
          sender: "GSENDER",
          recipient: "GRECIPIENT",
        },
        {
          client: {
            issuer: {
              async getWellKnown() {
                return {
                  api_version: "1.0",
                  issuer_stellar_address: "GISSUER",
                  proof_package_schema: 1,
                };
              },
              async createProofPackage() {
                return {} as never;
              },
            },
            async validatePackage() {
              throw new Error("invalid proof package");
            },
            async prove() {
              return {} as never;
            },
            async simulateSettle() {
              return {};
            },
          },
        },
      ),
    /invalid proof package/,
  );
});

test("runIssuerConformance surfaces chain validation failures", async () => {
  await assert.rejects(
    () =>
      runIssuerConformance(
        {
          issuerUrl: "https://issuer.test",
          issuerPublicKey: "GISSUER",
          sender: "GSENDER",
          recipient: "GRECIPIENT",
        },
        {
          client: {
            issuer: {
              async getWellKnown() {
                return {
                  api_version: "1.0",
                  issuer_stellar_address: "GISSUER",
                  proof_package_schema: 1,
                };
              },
              async createProofPackage() {
                return {} as never;
              },
            },
            async validatePackage() {
              throw new Error("Package corridor roots stale vs chain");
            },
            async prove() {
              return {} as never;
            },
            async simulateSettle() {
              return {};
            },
          },
        },
      ),
    /stale vs chain/,
  );
});

test("loadIssuerConfig rejects SOURCE aliases and accepts real public keys", () => {
  assert.throws(
    () =>
      loadIssuerConfig({
        COMPLIANCE_CONTRACT_ID: "C123",
        SOURCE: "amoeba-admin",
        ISSUER_PUBLIC_KEY: undefined,
        OPERATOR_PUBLIC_KEY: undefined,
      }),
    /OPERATOR_PUBLIC_KEY or ISSUER_PUBLIC_KEY required/,
  );

  const cfg = loadIssuerConfig({
    COMPLIANCE_CONTRACT_ID: "C123",
    OPERATOR_PUBLIC_KEY: "GOPERATOR",
  });
  assert.equal(cfg.operatorPublicKey, "GOPERATOR");
});
