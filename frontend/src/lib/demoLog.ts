import type { ProofPackage } from "@wisp_/js";
import type { ProvenTransfer } from "@wisp_/sdk";
import { env } from "@/config/env";

const PREFIX = "[wisp:demo]";

export interface DemoFixtureStrkeys {
  sender_strkey?: string;
  recipient_strkey?: string;
  issuer_strkey?: string;
  asset_strkey?: string;
  epoch?: string;
}

let fixtureCache: DemoFixtureStrkeys | null = null;

function enabled(): boolean {
  if (import.meta.env.VITE_WISP_DEBUG === "1") {
    (globalThis as { __WISP_DEBUG__?: boolean }).__WISP_DEBUG__ = true;
    return true;
  }
  return false;
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
    "DuplicateNullifier — this nullifier is already on-chain. Change the amount (even by 0.000001 USDC), fetch a new proof package, reprove, then submit.",
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
    "StaleIssuerRoot — publish roots: curl -X POST -H 'Authorization: Bearer demo-token' -H 'Content-Type: application/json' http://localhost:3000/v1/admin/roots/publish -d '{}'",
  ],
  [
    /insufficient allowance/i,
    "SAC allowance missing — approve Circle USDC for the compliance contract before settling.",
  ],
  [
    /resulting balance is not within the allowed range/i,
    "Insufficient Circle USDC on the SAC — trustline is OK but balance is 0. Fund GAVRI… from faucet.circle.com (Stellar Testnet). Demo USDC (GAIVU issuer) does not count.",
  ],
  [
    /trustline entry is missing/i,
    "Circle USDC trustline missing — in Freighter add USDC with issuer GBBD47… (circle.com), then fund from faucet.circle.com (Stellar Testnet).",
  ],
  [
    /op_underfunded|insufficient balance/i,
    "Insufficient Circle USDC — add the circle.com USDC asset in Freighter and fund the wallet (faucet.circle.com → Stellar Testnet).",
  ],
  [
    /Error\(Contract,\s*#14\)/,
    "InvalidProof — proof failed on-chain verification. Usually stale circuit artifacts or the testnet verifier was not redeployed after a circuit change. Run ensure-testnet-vk, refetch the proof package, reprove, then submit.",
  ],
  [
    /Error\(Contract,\s*#13\)/,
    "PublicInputMismatch — proof public inputs do not match on-chain state. Roots may be stale after a compliance redeploy: republish via issuer (POST /v1/admin/roots/publish), then refetch the proof package, reprove, and ensure Freighter is the KYC-approved sender.",
  ],
];

const ISSUER_HINTS: [RegExp, string][] = [
  [
    /Failed to fetch|fetch failed|network ?error|Load failed/i,
    "Issuer temporarily unreachable — if you just restarted the backend, wait a few seconds and retry. In local dev, restart ./scripts/dev/bru.sh so Vite proxy and issuer env are in sync.",
  ],
  [
    /Package issuer roots stale vs chain/i,
    "Issuer roots on-chain are behind the proof package — republish (curl -X POST -H 'Authorization: Bearer demo-token' http://localhost:3000/v1/admin/roots/publish -d '{\"corridor_id\":1}'), then refetch the proof package and reprove.",
  ],
  [
    /Package corridor roots stale vs chain/i,
    "Corridor roots on-chain are behind the proof package — republish roots via issuer, then refetch the proof package and reprove.",
  ],
  [
    /On-chain issuer\/corridor roots not found/i,
    "Chain event scan missed issuer roots — set VITE_VALIDATE_START_LEDGER to your compliance deploy ledger (see .wisp/compliance.env), restart the Vite dev server, and run ./scripts/dev/bru.sh if the issuer is local.",
  ],
  [
    /Issuer .+ is not registered on-chain/i,
    "Complete SEP-10 wallet verification for your connected Freighter wallet — the issuer only builds packages for verified senders.",
  ],
  [
    /recipient not approved for corridor/i,
    "Recipient not in corridor destination registry — click “Approve recipient destination” in the demo banner, or POST /v1/admin/corridors/1/destinations then republish roots.",
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
