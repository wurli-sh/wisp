import type { ProofPackage } from "@wisp_/js";
import type { ProvenTransfer } from "@wisp_/sdk/browser";
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
    "StaleIssuerRoot — publish roots: curl -X POST -H 'Authorization: Bearer demo-token' -H 'Content-Type: application/json' http://localhost:3000/admin/roots/publish -d '{}'",
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
    /tx_bad_auth|tx_bad_auth_extra/i,
    "Signature rejected (tx_bad_auth) — Freighter signed for a different network or account. Set Freighter to Test Net and ensure the connected account matches the transaction source, then retry.",
  ],
  [
    /tx_bad_seq/i,
    "Stale sequence number (tx_bad_seq) — the account moved since the tx was built. Just retry; the SDK reloads the latest sequence.",
  ],
  [
    /op_low_reserve/i,
    "Not enough XLM for the trustline reserve (op_low_reserve) — each trustline locks 0.5 XLM. Fund more testnet XLM via Friendbot and retry.",
  ],
  [
    /op_no_issuer/i,
    "Asset issuer not found (op_no_issuer) — the Circle USDC issuer (GBBD47…) was not found on this network. Confirm Freighter and the app are both on Stellar Test Net.",
  ],
  [
    /approve simulation failed/i,
    "USDC allowance approval failed during simulation — usually the wallet has no Circle USDC trustline/balance, or the SAC contract id is wrong. Confirm the Circle USDC trustline (issuer GBBD47…) and fund from faucet.circle.com (Stellar Testnet), then retry.",
  ],
  [
    /approve transaction failed|approve send failed|approve transaction not confirmed/i,
    "USDC allowance approval was submitted but did not succeed on-chain — check the Soroban RPC and that the wallet still holds enough XLM for fees, then retry.",
  ],
  [
    /account .+ not found on-chain/i,
    "Wallet account does not exist on-chain yet — fund it with testnet XLM via Friendbot, then retry.",
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
    "PublicInputMismatch — proof public inputs do not match on-chain state. Roots may be stale after a compliance redeploy: republish via issuer (POST /admin/roots/publish), then refetch the proof package, reprove, and ensure Freighter is the KYC-approved sender.",
  ],
];

const ISSUER_HINTS: [RegExp, string][] = [
  [
    /Failed to fetch|fetch failed|network ?error|Load failed/i,
    "Issuer temporarily unreachable — if you just restarted the backend, wait a few seconds and retry. In local dev, restart ./scripts/dev/bru.sh so Vite proxy and issuer env are in sync.",
  ],
  [
    /Package issuer roots stale vs chain/i,
    "Issuer roots on-chain are behind the proof package — republish (curl -X POST -H 'Authorization: Bearer demo-token' http://localhost:3000/admin/roots/publish -d '{\"corridor_id\":1}'), then refetch the proof package and reprove.",
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
    "Recipient not in corridor destination registry — click “Approve recipient destination” in the demo banner, or POST /admin/corridors/1/destinations then republish roots.",
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

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    // Common non-Error shapes (RPC/transport rejections, issuer JSON bodies).
    for (const key of ["message", "error", "detail", "reason"] as const) {
      const value = obj[key];
      if (typeof value === "string" && value) return value;
    }
    // Axios/fetch-like nested response payloads.
    const response = obj.response as { data?: unknown; statusText?: string } | undefined;
    if (response) {
      const data = response.data;
      // Stellar Horizon embeds the real failure reason here on tx 400s.
      const resultCodes = (data as { extras?: { result_codes?: unknown } } | undefined)
        ?.extras?.result_codes;
      if (resultCodes && typeof resultCodes === "object") {
        return `Horizon rejected the transaction: ${JSON.stringify(resultCodes)}`;
      }
      if (typeof data === "string" && data) return data;
      if (data && typeof data === "object") {
        const nested = (data as Record<string, unknown>).message ?? (data as Record<string, unknown>).error;
        if (typeof nested === "string" && nested) return nested;
      }
      if (typeof response.statusText === "string" && response.statusText) return response.statusText;
    }
    try {
      const json = JSON.stringify(err);
      if (json && json !== "{}") return json;
    } catch {
      // fall through to String() below
    }
  }
  return String(err);
}

export function formatDemoError(err: unknown): string {
  const msg = extractErrorMessage(err);
  for (const [pattern, hint] of ISSUER_HINTS) {
    if (pattern.test(msg)) return `${msg}\n\n→ ${hint}`;
  }
  for (const [pattern, hint] of CONTRACT_HINTS) {
    if (pattern.test(msg)) return `${msg}\n\n→ ${hint}`;
  }
  return msg;
}

const GENERIC_FRIENDLY = "Something went wrong. Please try again.";

/**
 * Short, user-facing messages for toasts. These intentionally hide raw
 * contract/RPC text and operator runbooks (kept in {@link formatDemoError} for
 * the console) so the UI stays calm and understandable.
 */
const FRIENDLY_HINTS: [RegExp, string][] = [
  [/Error\(Contract,\s*#9\)/, "This transfer was already settled. Adjust the amount and try again."],
  [/Error\(Contract,\s*#1[67]\)|StaleEpoch|FutureEpoch/, "Your proof is out of date. Fetch a fresh proof package and retry."],
  [/Error\(Contract,\s*#1[34]\)/, "We couldn't verify the proof on-chain. Fetch a fresh proof package and retry."],
  [/Error\(Contract,\s*#8\)|roots stale vs chain|roots not found|is not registered on-chain/i, "The issuer is still syncing. Please retry in a moment."],
  [/insufficient allowance/i, "Approve USDC for the compliance contract, then try again."],
  [/resulting balance is not within the allowed range|op_underfunded|insufficient balance/i, "Not enough testnet USDC in this wallet."],
  [/trustline entry is missing/i, "Add the USDC trustline in Freighter, then try again."],
  [/tx_bad_auth/i, "Signature was rejected. Set Freighter to Test Net and use the connected account, then try again."],
  [/tx_bad_seq/i, "Account changed mid-flight. Please try again."],
  [/op_low_reserve/i, "Not enough XLM to reserve the trustline. Fund more testnet XLM and try again."],
  [/op_no_issuer/i, "The USDC issuer wasn't found. Make sure Freighter is on Test Net, then try again."],
  [/approve simulation failed/i, "Couldn't approve USDC. Make sure you've added the Circle USDC trustline and have a balance, then try again."],
  [/approve transaction failed|approve send failed|approve transaction not confirmed/i, "Approving USDC didn't go through. Please try again in a moment."],
  [/account .+ not found on-chain/i, "Fund this wallet with testnet XLM first, then try again."],
  [/Failed to fetch|fetch failed|network ?error|Load failed/i, "Can't reach the issuer right now. Please retry in a moment."],
  [/recipient not approved for corridor/i, "This recipient isn't approved for the corridor yet."],
  [/active credential not found|sender missing from membership set/i, "Finish verifying this wallet, then try again."],
  [/challenge expired|already consumed/i, "Verification timed out. Please verify your wallet again."],
];

/** Concise, friendly one-liner for toasts; full detail goes to the console. */
export function friendlyError(err: unknown): string {
  const msg = extractErrorMessage(err);
  for (const [pattern, friendly] of FRIENDLY_HINTS) {
    if (pattern.test(msg)) return friendly;
  }
  return GENERIC_FRIENDLY;
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
