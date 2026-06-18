#!/usr/bin/env tsx
/**
 * Issuer API v1 conformance: well-known → proof-package → validate → prove.
 *
 * Prerequisites:
 * - issuer-service running at ISSUER_URL
 * - KYC-approved sender + corridor destination seeded (use --seed for reference issuer)
 * - Roots published on-chain for ISSUER_PUBLIC_KEY + COMPLIANCE_CONTRACT_ID
 *
 * Usage:
 *   ISSUER_URL=http://127.0.0.1:3000 pnpm test:issuer-conformance
 *   pnpm test:issuer-conformance -- --seed
 *   pnpm test:issuer-conformance -- --sender G... --recipient G... --amount 10000000
 *   pnpm test:issuer-conformance -- --simulate-settle
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAmoebaEnv } from "@amoeba_/sdk";
import { runIssuerConformance } from "../../issuer-sdk/src/index.ts";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

interface CliArgs {
  sender?: string;
  recipient?: string;
  amount: string;
  corridorId: number;
  strict: boolean;
  skipProve: boolean;
  seed: boolean;
  simulateSettle: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    amount: "10000000",
    corridorId: 1,
    strict: false,
    skipProve: false,
    seed: false,
    simulateSettle: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = argv[i + 1];
    switch (flag) {
      case "--sender":
        args.sender = next;
        i += 1;
        break;
      case "--recipient":
        args.recipient = next;
        i += 1;
        break;
      case "--amount":
        args.amount = next!;
        i += 1;
        break;
      case "--corridor-id":
        args.corridorId = Number(next);
        i += 1;
        break;
      case "--strict":
        args.strict = true;
        break;
      case "--skip-prove":
        args.skipProve = true;
        break;
      case "--seed":
        args.seed = true;
        break;
      case "--simulate-settle":
        args.simulateSettle = true;
        break;
      default:
        break;
    }
  }
  return args;
}

function issuerListenAddr(issuerUrl: string): string {
  const parsed = new URL(issuerUrl);
  return `${parsed.hostname}:${parsed.port || (parsed.protocol === "https:" ? "443" : "80")}`;
}

async function main(): Promise<void> {
  const cli = parseArgs(process.argv.slice(2));
  const env = loadAmoebaEnv();
  const issuerUrl = env.ISSUER_URL ?? "http://127.0.0.1:3000";
  const issuerPk = env.ISSUER_PUBLIC_KEY;
  if (!issuerPk) {
    throw new Error("ISSUER_PUBLIC_KEY required");
  }

  if (cli.seed) {
    console.log("0. Seed reference issuer KYC fixture");
    const seed = spawnSync("bash", [`${ROOT}/scripts/dev/seed-testnet-issuer.sh`], {
      stdio: "inherit",
      env: {
        ...process.env,
        ISSUER_LISTEN_ADDR: issuerListenAddr(issuerUrl),
      },
    });
    if (seed.status !== 0) {
      throw new Error("seed-testnet-issuer.sh failed");
    }
  }

  const sender = cli.sender ?? env.SENDER_PUBLIC_KEY;
  const recipient = cli.recipient ?? env.RECIPIENT_PUBLIC_KEY;
  if (!sender || !recipient) {
    throw new Error(
      "SENDER_PUBLIC_KEY and RECIPIENT_PUBLIC_KEY required (or pass --sender/--recipient). " +
        "Run with --seed against reference issuer first.",
    );
  }

  console.log("1-5. Run conformance flow");
  const result = await runIssuerConformance({
    issuerUrl,
    issuerPublicKey: issuerPk,
    sender,
    recipient,
    amount: cli.amount,
    corridorId: cli.corridorId,
    strict: cli.strict,
    skipProve: cli.skipProve,
    simulateSettle: cli.simulateSettle,
    simulationPublicKey: env.SENDER_PUBLIC_KEY,
  });
  const wellKnown = result.wellKnown;
  console.log("   api_version:", wellKnown.api_version);
  console.log("   issuer:", wellKnown.issuer_stellar_address);
  console.log("   validatePackage: PASS");
  if (result.proven) {
    console.log("   nullifier:", result.proven.nullifier.slice(0, 16) + "…");
  }
  if (cli.simulateSettle) {
    console.log("   simulateSettle: PASS");
  }

  console.log("\nIssuer conformance PASSED");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
