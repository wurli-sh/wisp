#!/usr/bin/env tsx
/**
 * Generate bindings/fixtures/demo-transfer-testnet.json from Stellar identities.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { payloadToHex, strKeyToPayload } from "@amoeba_/js/strkey";
import { loadAmoebaEnv } from "@amoeba_/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");
const OUT = path.join(ROOT, "bindings/fixtures/demo-transfer-testnet.json");
const EPOCH_LEN = 86400;

function stellarAddress(identity: string): string {
  return execSync(`stellar keys public-key "${identity}"`, {
    encoding: "utf8",
  }).trim();
}

function fetchEpoch(rpcUrl: string): number {
  const res = execSync(
    `curl -sf "${rpcUrl}" -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"getLatestLedger"}'`,
    { encoding: "utf8" },
  );
  const json = JSON.parse(res) as {
    result?: { ledger?: { closeTime?: number }; closeTime?: number };
  };
  const ts = Number(json.result?.ledger?.closeTime ?? json.result?.closeTime ?? 0);
  if (!ts) throw new Error("could not fetch ledger timestamp from RPC");
  return Math.floor(ts / EPOCH_LEN);
}

const env = { ...loadAmoebaEnv(ROOT), ...process.env };
const senderId = env.SENDER_IDENTITY ?? "amoeba-sender";
const recipientId = env.RECIPIENT_IDENTITY ?? "amoeba-recipient";
const issuerId = env.ISSUER_IDENTITY ?? "amoeba-issuer";

const senderStrkey = env.SENDER_PUBLIC_KEY ?? stellarAddress(senderId);
const recipientStrkey = env.RECIPIENT_PUBLIC_KEY ?? stellarAddress(recipientId);
const issuerStrkey = env.ISSUER_PUBLIC_KEY ?? stellarAddress(issuerId);

const CIRCLE_JSON = path.join(ROOT, "bindings/fixtures/circle-testnet-usdc.json");

function circleSacId(): string {
  if (!fs.existsSync(CIRCLE_JSON)) {
    console.error(`Missing ${CIRCLE_JSON} — run pin-circle-ids migration`);
    process.exit(1);
  }
  const circle = JSON.parse(fs.readFileSync(CIRCLE_JSON, "utf8")) as {
    sac_contract_id?: string;
  };
  if (!circle.sac_contract_id) {
    console.error(`Missing sac_contract_id in ${CIRCLE_JSON}`);
    process.exit(1);
  }
  return circle.sac_contract_id;
}

let assetStrkey = env.SAC_CONTRACT_ID ?? env.ASSET_ID;
if (!assetStrkey) {
  const sac = loadAmoebaEnv(ROOT);
  assetStrkey = sac.SAC_CONTRACT_ID ?? sac.ASSET_ID;
}
assetStrkey = assetStrkey ?? circleSacId();
if (!assetStrkey) {
  console.error(
    "Set SAC_CONTRACT_ID or run setup-circle-usdc-testnet.sh / bootstrap-testnet-demo.sh",
  );
  process.exit(1);
}

const epoch =
  env.TESTNET_EPOCH ??
  (env.STELLAR_RPC_URL
    ? String(fetchEpoch(env.STELLAR_RPC_URL))
    : String(fetchEpoch("https://soroban-testnet.stellar.org")));

const fixture = {
  demo_only: true,
  credential_secret: env.TESTNET_CREDENTIAL_SECRET ?? "424242",
  transfer_nonce: env.TESTNET_TRANSFER_NONCE ?? "0",
  corridor_id: Number(env.CORRIDOR_ID ?? 1),
  sender_hex: payloadToHex(strKeyToPayload(senderStrkey)),
  recipient_hex: payloadToHex(strKeyToPayload(recipientStrkey)),
  asset_hex: payloadToHex(strKeyToPayload(assetStrkey)),
  amount: env.TESTNET_AMOUNT ?? "10000000",
  epoch,
  jurisdiction: env.TESTNET_JURISDICTION ?? "840",
  credential_expiry: env.TESTNET_CREDENTIAL_EXPIRY ?? "2000000000",
  sender_strkey: senderStrkey,
  recipient_strkey: recipientStrkey,
  asset_strkey: assetStrkey,
  issuer_strkey: issuerStrkey,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(fixture, null, 2) + "\n");
console.log(`Wrote ${OUT} (epoch=${epoch})`);
