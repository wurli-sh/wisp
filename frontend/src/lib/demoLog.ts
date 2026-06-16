import type { ProofPackage } from "@amoeba/js";
import type { ProvenTransfer } from "@amoeba/sdk";
import { env } from "@/config/env";

const PREFIX = "[amoeba:demo]";

export interface DemoFixtureStrkeys {
  sender_strkey?: string;
  recipient_strkey?: string;
  issuer_strkey?: string;
  asset_strkey?: string;
  epoch?: string;
}

let fixtureCache: DemoFixtureStrkeys | null = null;

function enabled(): boolean {
  if (import.meta.env.DEV) {
    (globalThis as { __AMOEBA_DEBUG__?: boolean }).__AMOEBA_DEBUG__ = true;
    return true;
  }
  return import.meta.env.VITE_AMOEBA_DEBUG === "1";
}

export function demoLog(checkpoint: string, data?: Record<string, unknown>): void {
  if (!enabled()) return;
  if (data) console.info(PREFIX, checkpoint, data);
  else console.info(PREFIX, checkpoint);
}

export function demoWarn(checkpoint: string, data?: Record<string, unknown>): void {
  if (!enabled()) return;
  console.warn(PREFIX, checkpoint, data ?? "");
}

export async function loadDemoFixtureStrkeys(): Promise<DemoFixtureStrkeys> {
  if (fixtureCache) return fixtureCache;
  const res = await fetch(env.demoFixtureUrl);
  if (!res.ok) throw new Error(`fixture fetch failed: ${res.status}`);
  fixtureCache = (await res.json()) as DemoFixtureStrkeys;
  return fixtureCache;
}

export function packageCheckpoint(pkg: ProofPackage): Record<string, unknown> {
  const t = pkg.transfer;
  const r = pkg.roots;
  const d = pkg.demo;
  return {
    epoch: t?.epoch,
    corridor_id: t?.corridor_id,
    amount: t?.amount,
    recipient_hex: t?.recipient?.slice(0, 16) + "…",
    sender_strkey: d?.sender_strkey,
    recipient_strkey: d?.recipient_strkey,
    source_country: d?.source_country,
    dest_country: d?.dest_country,
    merkle_root: r?.merkle_root,
    corridor_config_hash: r?.corridor_config_hash,
  };
}

export function provenCheckpoint(
  proven: ProvenTransfer,
  pkg: ProofPackage,
): Record<string, unknown> {
  return {
    nullifier: proven.nullifier,
    epoch: pkg.transfer?.epoch,
    sender_strkey: pkg.demo?.sender_strkey,
    recipient_strkey: pkg.demo?.recipient_strkey,
    public_signals: proven.publicSignals.length,
  };
}

export function configCheckpoint(): Record<string, unknown> {
  return {
    profile: env.profile,
    compliance_id: env.complianceId,
    issuer: env.issuerPublicKey,
    issuer_url: env.issuerUrl,
    rpc: env.rpcUrl,
  };
}

const CONTRACT_HINTS: [RegExp, string][] = [
  [
    /Error\(Contract,\s*#9\)/,
    "DuplicateNullifier — this nullifier is already on-chain. Change inputs or fetch a fresh package so sender, recipient, amount, and epoch produce a new nullifier.",
  ],
  [
    /Error\(Contract,\s*#16\)/,
    "FutureEpoch — fixture epoch is ahead of chain time. Run gen-testnet-fixture.ts (no manual TESTNET_EPOCH).",
  ],
  [
    /Error\(Contract,\s*#17\)/,
    "StaleEpoch — epoch too old. Refresh fixture and reprove.",
  ],
  [
    /Error\(Contract,\s*#8\)/,
    "StaleIssuerRoot — publish roots: curl -X POST -H 'Authorization: Bearer demo-token' http://localhost:3000/v1/roots/publish",
  ],
  [
    /Error\(Contract,\s*#14\)/,
    "InvalidProof — proof bytes failed verification (tampered or wrong circuit).",
  ],
  [
    /Error\(Contract,\s*#13\)/,
    "PublicInputMismatch — proof public inputs do not match on-chain state / fixture.",
  ],
];

const ISSUER_HINTS: [RegExp, string][] = [
  [
    /approved sender not found/i,
    "Complete mock KYC for your connected Freighter wallet — the issuer only builds packages for KYC-approved senders.",
  ],
  [
    /recipient not approved for corridor/i,
    "Use the demo recipient from the testnet fixture (prefilled on load) or ask the operator to approve this address.",
  ],
  [
    /active credential not found/i,
    "KYC credential missing — retry mock KYC for this wallet.",
  ],
  [
    /sender missing from membership set/i,
    "Issuer Merkle tree does not include this wallet — complete mock KYC and retry.",
  ],
];

export function formatDemoError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  for (const [pattern, hint] of ISSUER_HINTS) {
    if (pattern.test(msg)) return `${msg}\n\n→ ${hint}`;
  }
  for (const [pattern, hint] of CONTRACT_HINTS) {
    if (pattern.test(msg)) return `${msg}\n\n→ ${hint}`;
  }
  return msg;
}

export function checkWalletSender(
  walletAddress: string,
  expectedSender: string | undefined,
): void {
  if (!expectedSender) return;
  if (walletAddress === expectedSender) {
    demoLog("wallet.ok", { address: walletAddress });
    return;
  }
  demoWarn("wallet.mismatch", {
    freighter: walletAddress,
    fixture_sender: expectedSender,
    hint: "Settle signs with Freighter but sender_strkey comes from the fixture — switch account or regenerate fixture.",
  });
}
