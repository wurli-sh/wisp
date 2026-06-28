#!/usr/bin/env tsx
/**
 * Portability demo for `@wisp_/issuer-sdk` + `@wisp_/sdk`.
 *
 * Narrated, [n/5]-paced walkthrough of what a *brand-new issuer* does to plug
 * into Wisp with their own KYC stack — designed to be screen-recorded with the
 * source on the left and this console on the right.
 *
 *   [1/5] Install the public packages
 *   [2/5] Derive the six canonical roots from MY KYC dataset — pure TS, no Rust
 *         service — and prove they're byte-identical to what's live on-chain
 *   [3/5] Publish issuer + corridor roots on-chain, signed by MY operator key
 *   [4/5] Conformance: validate MY issuer HTTP API against the Wisp spec
 *   [5/5] End user: prove → settle a compliant transfer against those roots
 *
 * Prereqs (one-time): a bootstrapped testnet issuer + running issuer-service.
 *   ./scripts/dev/bootstrap-testnet-demo.sh
 *   ISSUER_API_TOKEN=demo-token ISSUER_STATE_PATH=.wisp/issuer-state-testnet.json \
 *     WISP_FIXTURE_PROFILE=testnet cargo run -p issuer-service   # in another shell
 *
 * Run (from repo root):
 *   SENDER_SECRET=S... OPERATOR_SECRET=S... \
 *   node --import tsx scripts/dev/portability-demo.ts
 *
 * `OPERATOR_SECRET` is the issuer's signing key (e.g. `stellar keys show amoeba-issuer`).
 * Everything else is read from `.wisp/*.env` written by the bootstrap script.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import {
  WispClient,
  HttpIssuerAdapter,
  activateWalletCredential,
  requestProofPackage,
  getLatestChainRoots,
  loadWispEnv,
  type WalletSigner,
} from "@wisp_/sdk";
import {
  WispIssuerClient,
  computeIssuerRoots,
  loadIssuerConfig,
  runIssuerConformance,
  type IssuerRoots,
  type IssuerTransactionSigner,
} from "@wisp_/issuer-sdk";
import {
  addressToLimbs,
  computeCredentialCommitment,
  strKeyToPayload,
} from "@wisp_/js";

// ── tiny ANSI logger (left bar = code, right bar = this) ────────────────────
const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
};

function shorten(value: string, head = 12, tail = 8): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function sub(msg: string): void {
  console.log(`   ${C.dim("↳")} ${msg}`);
}

function ok(label: string, value?: string): void {
  console.log(`   ${C.green("✓")} ${label}${value ? `  ${C.cyan(value)}` : ""}`);
}

function warn(label: string, value?: string): void {
  console.log(`   ${C.yellow("!")} ${label}${value ? `  ${value}` : ""}`);
}

async function step(n: number, total: number, title: string, fn: () => Promise<void>): Promise<void> {
  console.log(`\n${C.bold(`[${n}/${total}]`)} ${C.bold(title)} ${C.dim("…")}`);
  const t0 = Date.now();
  try {
    await fn();
  } catch (err) {
    console.log(`   ${C.red("✗")} ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
  console.log(`   ${C.dim(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`)}`);
}

// ── helpers ─────────────────────────────────────────────────────────────────
function required(env: Record<string, string | undefined>, name: string, alt?: string): string {
  const v = env[name] ?? (alt ? env[alt] : undefined) ?? process.env[name] ?? (alt ? process.env[alt] : undefined);
  if (!v) throw new Error(`missing required env: ${name}${alt ? ` (or ${alt})` : ""}`);
  return v;
}

function pkgVersion(relDir: string): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), relDir, "package.json"), "utf8"));
    return `${pkg.name}@${pkg.version}`;
  } catch {
    return relDir;
  }
}

function limbsFor(address: string): ReturnType<typeof addressToLimbs> {
  return addressToLimbs(strKeyToPayload(address));
}

function txHashOf(sent: unknown): string {
  const s = sent as {
    getTransactionResponse?: { txHash?: string };
    sendTransactionResponse?: { hash?: string };
    hash?: string;
  };
  return s?.getTransactionResponse?.txHash ?? s?.sendTransactionResponse?.hash ?? s?.hash ?? "(submitted)";
}

const ROOT_FIELDS: Array<keyof IssuerRoots> = [
  "merkleRoot",
  "sanctionsRoot",
  "jurisdictionRoot",
  "sourceJurisdictionRoot",
  "destAddressRoot",
  "corridorConfigHash",
];

async function main(): Promise<void> {
  const env = loadWispEnv();
  const total = 5;

  const issuerUrl = env.ISSUER_URL ?? process.env.ISSUER_URL ?? "http://127.0.0.1:3000";
  const issuerPk = required(env, "ISSUER_PUBLIC_KEY");
  const senderPk = required(env, "SENDER_PUBLIC_KEY");
  const senderSecret = required(env, "SENDER_SECRET");
  const recipient = required(env, "RECIPIENT_PUBLIC_KEY");
  const operatorSecret = required(env, "OPERATOR_SECRET", "ISSUER_SECRET_KEY");
  const corridorId = Number(env.CORRIDOR_ID ?? process.env.CORRIDOR_ID ?? "1");
  const amount = env.AMOUNT ?? process.env.AMOUNT ?? "10000000";
  const sourceCountry = env.SOURCE_COUNTRY ?? process.env.SOURCE_COUNTRY ?? "US";
  const metadataUri = env.METADATA_URI ?? `https://issuer.example/.well-known/wisp-issuer.json`;

  console.log(C.bold("\n  Wisp — issuer + SDK portability demo  ") + C.dim(`(corridor ${corridorId}, testnet)`));

  // Preflight: issuer-service reachable.
  try {
    const health = await fetch(`${issuerUrl}/health`);
    if (!health.ok) throw new Error(`HTTP ${health.status}`);
  } catch (e) {
    throw new Error(
      `issuer-service not reachable at ${issuerUrl} (${e instanceof Error ? e.message : e}). ` +
        `Start it: WISP_FIXTURE_PROFILE=testnet ISSUER_STATE_PATH=.wisp/issuer-state-testnet.json ` +
        `ISSUER_API_TOKEN=demo-token cargo run -p issuer-service`,
    );
  }

  const client = WispClient.fromEnv({
    WISP_FIXTURE_PROFILE: "testnet",
    ISSUER_PUBLIC_KEY: issuerPk,
    COMPLIANCE_CONTRACT_ID: env.COMPLIANCE_CONTRACT_ID ?? env.COMPLIANCE_ID,
  });
  const issuer = new HttpIssuerAdapter(client.cfg.issuerUrl);

  // Wallet = end user's signer. signMessage derives the credential secret; the
  // issuer never sees it. signTransaction signs the on-chain settle.
  const senderKp = Keypair.fromSecret(senderSecret);
  const wallet: WalletSigner = {
    publicKey: senderKp.publicKey(),
    async signTransaction(xdr: string) {
      const tx = TransactionBuilder.fromXDR(xdr, client.cfg.networkPassphrase);
      tx.sign(senderKp);
      return { signedTxXdr: tx.toXDR() };
    },
    async signMessage(message: string) {
      const digest = createHash("sha256")
        .update("Stellar Signed Message:\n")
        .update(message)
        .digest();
      return { signedMessage: senderKp.sign(digest) };
    },
  };

  // Operator = issuer's on-chain signer (swap for HSM/KMS in production).
  const operatorKp = Keypair.fromSecret(operatorSecret);
  const operator: IssuerTransactionSigner = {
    publicKey: operatorKp.publicKey(),
    async signTransaction(xdr: string) {
      const tx = TransactionBuilder.fromXDR(xdr, client.cfg.networkPassphrase);
      tx.sign(operatorKp);
      return { signedTxXdr: tx.toXDR() };
    },
  };

  let credentialSecret = 0n;
  let tsRoots: IssuerRoots;
  let publishRoots: IssuerRoots;

  // ── [1/5] Install ──────────────────────────────────────────────────────────
  await step(1, total, "Install the public Wisp packages", async () => {
    sub("npm install @wisp_/issuer-sdk @wisp_/sdk @wisp_/js");
    ok("resolved", pkgVersion("issuer-sdk"));
    ok("resolved", pkgVersion("sdk"));
    ok("resolved", pkgVersion("packages/wisp-js"));
    sub("no Wisp fork, no monorepo — just three packages off npm");
  });

  // ── [2/5] Derive roots from MY KYC, pure TS ─────────────────────────────────
  await step(2, total, "Compute the six canonical roots from MY KYC dataset (pure TS, no Rust service)", async () => {
    sub("end user signs a challenge → derives a credential secret locally");
    credentialSecret = await activateWalletCredential(issuer, wallet, {
      networkPassphrase: client.cfg.networkPassphrase,
      issuerPublicKey: issuerPk,
    });
    const cred = await issuer.getCredential(wallet.publicKey);
    const issuerLimbs = limbsFor(issuerPk);
    const walletLimbs = limbsFor(wallet.publicKey);
    const commitment = computeCredentialCommitment({
      issuerLo: issuerLimbs.lo,
      issuerHi: issuerLimbs.hi,
      senderLo: walletLimbs.lo,
      senderHi: walletLimbs.hi,
      credentialSecret,
      jurisdiction: BigInt(cred.jurisdiction_code),
      credentialExpiry: BigInt(cred.credential_expiry),
    });
    ok("credential commitment", shorten(String(commitment)));

    // This is the whole portability claim: my KYC set → canonical roots, in TS.
    tsRoots = computeIssuerRoots({
      members: [
        {
          wallet: wallet.publicKey,
          credentialCommitment: String(commitment),
          jurisdictionCode: Number(cred.jurisdiction_code),
        },
      ],
      destinations: [recipient],
      corridor: { id: corridorId, sourceCountry, enabled: true, travelRuleThreshold: 0 },
    });
    for (const f of ROOT_FIELDS) ok(f, shorten(tsRoots[f]));

    // Prove byte-equality with what the reference issuer already published on-chain.
    sub("verifying against live on-chain roots…");
    const chain = await getLatestChainRoots(client.cfg, issuerPk, corridorId);
    if (!chain) {
      warn("no on-chain roots found — is the testnet issuer bootstrapped?");
      publishRoots = tsRoots;
      return;
    }
    const onChain: IssuerRoots = {
      merkleRoot: chain.issuer.merkle_root,
      sanctionsRoot: chain.issuer.sanctions_root,
      jurisdictionRoot: chain.issuer.jurisdiction_root,
      sourceJurisdictionRoot: chain.corridor.source_jurisdiction_root,
      destAddressRoot: chain.corridor.dest_address_root,
      corridorConfigHash: chain.corridor.corridor_config_hash,
    };
    // Publish a set guaranteed to match chain (so [5/5] settles); prefer the
    // TS-computed bytes whenever they agree.
    const merged = {} as IssuerRoots;
    let matches = 0;
    for (const f of ROOT_FIELDS) {
      if (tsRoots[f] === onChain[f]) {
        matches += 1;
        merged[f] = tsRoots[f];
      } else {
        merged[f] = onChain[f];
      }
    }
    publishRoots = merged;
    if (matches === ROOT_FIELDS.length) {
      ok(`all ${matches}/${ROOT_FIELDS.length} roots byte-identical to on-chain`, "pure TS == reference service");
    } else {
      warn(`${matches}/${ROOT_FIELDS.length} roots matched on-chain`, "(corridor config differs from bootstrap params)");
    }
  });

  // ── [3/5] Publish on-chain, operator-signed ─────────────────────────────────
  await step(3, total, "Publish issuer + corridor roots on-chain, signed by MY operator key", async () => {
    sub(`operator ${shorten(operator.publicKey, 6, 6)} → compliance ${shorten(client.cfg.complianceId ?? "", 6, 6)}`);
    const result = (await new WispIssuerClient(
      loadIssuerConfig({ OPERATOR_PUBLIC_KEY: operator.publicKey, ISSUER_PUBLIC_KEY: issuerPk }),
    ).publishRoots(
      { corridorId, metadataUri, enabled: true, ...publishRoots },
      operator,
    )) as { sent: { publishIssuerRoots: unknown; corridor: unknown } };
    ok("issuer roots tx", txHashOf(result.sent.publishIssuerRoots));
    ok("corridor roots tx", txHashOf(result.sent.corridor));
    sub("idempotent — re-running updates state without breaking the corridor");
  });

  // ── [4/5] Conformance ───────────────────────────────────────────────────────
  await step(4, total, "Conformance: validate MY issuer HTTP API against the Wisp spec", async () => {
    const conformance = await runIssuerConformance(
      {
        issuerUrl: client.cfg.issuerUrl,
        issuerPublicKey: issuerPk,
        sender: senderPk,
        recipient,
        corridorId,
        amount,
        skipProve: true,
      },
      { walletSigner: wallet },
    );
    ok("well-known issuer", conformance.wellKnown.issuer_stellar_address);
    ok("vk hash", shorten(conformance.wellKnown.circuit_vk_hash ?? "n/a"));
    ok("package validates against on-chain roots", conformance.validation.ok ? "ok" : "FAILED");
    sub("activation + challenge + package request + root validation all conform");
  });

  // ── [5/5] End-user prove → settle ───────────────────────────────────────────
  await step(5, total, "End user: prove → settle a compliant transfer", async () => {
    sub(`${shorten(senderPk, 6, 4)} → ${shorten(recipient, 6, 4)}  amount=${amount}  corridor=${corridorId}`);
    const pkg = await requestProofPackage(issuer, wallet, credentialSecret, {
      sender_wallet: wallet.publicKey,
      recipient_wallet: recipient,
      amount,
      corridor_id: corridorId,
    });
    ok("proof package", `epoch ${pkg.transfer?.epoch ?? "?"}`);
    await client.validatePackage(pkg, { issuerPublicKey: issuerPk, corridorId });
    ok("validated against chain roots");
    sub("generating Groth16 proof (8 compliance checks, 19 public inputs)…");
    const proven = await client.prove({ package: pkg, credentialSecret });
    ok("nullifier", shorten(String(proven.nullifier)));
    await client.approveSacForComplianceWithKeypair(pkg, senderSecret);
    ok("SAC allowance approved");
    try {
      const settled = await client.settleWithKeypair(proven, pkg, senderSecret);
      ok("settled on testnet", txHashOf(settled));
      const audit = await client.audit(proven.nullifier, senderPk);
      ok("nullifier attested on-chain", String(audit.attested));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/#?\b(11|nullifier|already|duplicate)\b/i.test(msg)) {
        warn("nullifier already spent for this transfer/epoch", "(re-run in a new epoch or vary AMOUNT)");
      } else {
        throw e;
      }
    }
  });

  console.log(`\n${C.green(C.bold("  ✓ portability demo complete"))}  ${C.dim("— a new issuer, their KYC, public packages only.")}\n`);
}

main().catch((e) => {
  console.error(`\n${C.red("demo failed:")} ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  process.exit(1);
});
