#!/usr/bin/env tsx
/**
 * Diff Groth16 public inputs against issuer package roots and on-chain compliance state.
 */
import fs from "node:fs";
import path from "node:path";
import type { ProofPackage } from "@amoeba_/js";
import {
  PUBLIC_INPUT_FIELDS,
  normalizeField,
  rebuildExpectedPublicInputsFromRoots,
  publicSignalsMatch,
} from "@amoeba_/js";
import {
  AmoebaClient,
  DemoIssuerClient,
  getLatestChainRoots,
  loadAmoebaEnv,
  rootsMatch,
  type ProvenTransfer,
} from "@amoeba_/sdk";

interface CliArgs {
  provenPath?: string;
  packagePath?: string;
  fetch: boolean;
  sender?: string;
  recipient?: string;
  amount?: string;
  corridorId: number;
  issuerUrl: string;
  issuerToken?: string;
}

interface RootsRecord {
  merkle_root: string;
  sanctions_root: string;
  jurisdiction_root: string;
  corridor_config_hash: string;
  source_jurisdiction_root: string;
  dest_address_root: string;
}

function usage(): string {
  return `Usage: diff-public-inputs.ts [options]

Options:
  --proven <path>         ProvenTransfer JSON (publicSignals + nullifier)
  --package <path>        Proof package JSON
  --fetch                 Fetch package from issuer (requires sender/recipient/amount)
  --sender <strkey>       Sender wallet for --fetch
  --recipient <strkey>    Recipient wallet for --fetch
  --amount <micro>        Amount in USDC micro-units for --fetch
  --corridor-id <n>       Corridor id (default: 1)
  --issuer-url <url>      Issuer base URL (default: ISSUER_URL or http://127.0.0.1:3000)
  --issuer-token <token>  Bearer token for admin endpoints (default: ISSUER_API_TOKEN)
  -h, --help              Show help
`;
}

function parseArgs(argv: string[]): CliArgs {
  const env = loadAmoebaEnv();
  const args: CliArgs = {
    fetch: false,
    corridorId: 1,
    issuerUrl: env.ISSUER_URL ?? "http://127.0.0.1:3000",
    issuerToken: env.ISSUER_API_TOKEN,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = argv[i + 1];
    switch (flag) {
      case "--proven":
        args.provenPath = next;
        i += 1;
        break;
      case "--package":
        args.packagePath = next;
        i += 1;
        break;
      case "--fetch":
        args.fetch = true;
        break;
      case "--sender":
        args.sender = next;
        i += 1;
        break;
      case "--recipient":
        args.recipient = next;
        i += 1;
        break;
      case "--amount":
        args.amount = next;
        i += 1;
        break;
      case "--corridor-id":
        args.corridorId = Number(next);
        i += 1;
        break;
      case "--issuer-url":
        args.issuerUrl = next!;
        i += 1;
        break;
      case "--issuer-token":
        args.issuerToken = next;
        i += 1;
        break;
      case "-h":
      case "--help":
        console.log(usage());
        process.exit(0);
      default:
        throw new Error(`unknown flag: ${flag}\n\n${usage()}`);
    }
  }

  return args;
}

function loadJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8")) as T;
}

function toVector(values: bigint[]): bigint[] {
  return values.map((value) => normalizeField(value.toString()));
}

function vectorFromSignals(signals: string[]): bigint[] {
  return signals.map((signal) => normalizeField(signal));
}

function rootsFromChain(bundle: {
  issuer: {
    merkle_root: string;
    sanctions_root: string;
    jurisdiction_root: string;
  };
  corridor: {
    corridor_config_hash: string;
    source_jurisdiction_root: string;
    dest_address_root: string;
  };
}): RootsRecord {
  return {
    merkle_root: bundle.issuer.merkle_root,
    sanctions_root: bundle.issuer.sanctions_root,
    jurisdiction_root: bundle.issuer.jurisdiction_root,
    corridor_config_hash: bundle.corridor.corridor_config_hash,
    source_jurisdiction_root: bundle.corridor.source_jurisdiction_root,
    dest_address_root: bundle.corridor.dest_address_root,
  };
}

function buildVector(
  roots: RootsRecord,
  pkg: ProofPackage,
  nullifier: string,
): bigint[] {
  if (!pkg.transfer) throw new Error("package missing transfer");
  return toVector(
    rebuildExpectedPublicInputsFromRoots(roots, pkg.transfer, nullifier),
  );
}

function shortDecimal(value: bigint): string {
  const text = value.toString();
  if (text.length <= 20) return text;
  return `${text.slice(0, 10)}…${text.slice(-6)}`;
}

async function fetchComputedRoots(
  issuerUrl: string,
  token: string | undefined,
  corridorId: number,
): Promise<{
  computed_roots: RootsRecord;
  latest_root_snapshot: RootsRecord | null;
  snapshot_meta: Record<string, unknown> | null;
}> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(
    `${issuerUrl.replace(/\/$/, "")}/v1/admin/roots/computed?corridor_id=${corridorId}`,
    { headers },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`issuer computed roots: HTTP ${res.status}${text ? ` — ${text}` : ""}`);
  }
  const body = (await res.json()) as {
    computed_roots: RootsRecord;
    latest_root_snapshot: (RootsRecord & {
      publish_status?: string;
      compliance_contract_id?: string | null;
    }) | null;
  };
  return {
    computed_roots: body.computed_roots,
    latest_root_snapshot: body.latest_root_snapshot,
    snapshot_meta: body.latest_root_snapshot
      ? {
          publish_status: body.latest_root_snapshot.publish_status,
          compliance_contract_id: body.latest_root_snapshot.compliance_contract_id,
        }
      : null,
  };
}

function printRecommendations(input: {
  proven?: bigint[];
  fromPackage: bigint[];
  fromChain?: bigint[];
  fromIssuer?: bigint[];
  pkgRoots: RootsRecord;
  computedRoots: RootsRecord;
  chainRoots?: RootsRecord;
  snapshotRoots: RootsRecord | null;
}): void {
  const lines: string[] = [];

  if (input.proven && input.fromChain && !publicSignalsMatch(input.proven, input.fromChain)) {
    if (publicSignalsMatch(input.proven, input.fromPackage)) {
      lines.push(
        "Proof matches package roots but not on-chain roots — republish roots, refetch package, reprove, re-approve SAC, settle.",
      );
    } else if (!publicSignalsMatch(input.proven, input.fromPackage)) {
      lines.push(
        "Proof does not match the loaded package — refetch proof package and reprove before settling.",
      );
    }
  }

  if (input.chainRoots && !rootsMatch(input.computedRoots, input.chainRoots)) {
    lines.push(
      "Issuer computed roots differ from on-chain events — run ./scripts/dev/publish-roots-testnet-via-issuer.sh",
    );
  }

  if (input.snapshotRoots && !rootsMatch(input.computedRoots, input.snapshotRoots)) {
    lines.push(
      "Issuer DB trees changed since last publish snapshot — republish roots, then refetch package.",
    );
  }

  if (!rootsMatch(input.pkgRoots, input.computedRoots)) {
    lines.push("Package roots are stale vs issuer computed trees — refetch proof package.");
  }

  if (lines.length === 0) {
    console.log("\nNo root drift detected between package, issuer, and chain.");
  } else {
    console.log("\nRecommended actions:");
    for (const line of lines) console.log(`  - ${line}`);
  }
}

async function main(): Promise<void> {
  const cli = parseArgs(process.argv.slice(2));
  const client = AmoebaClient.fromEnv({ ISSUER_URL: cli.issuerUrl });

  let pkg: ProofPackage;
  if (cli.packagePath) {
    pkg = loadJson<ProofPackage>(cli.packagePath);
  } else if (cli.fetch) {
    if (!cli.sender || !cli.recipient || !cli.amount) {
      throw new Error("--fetch requires --sender, --recipient, and --amount");
    }
    pkg = await new DemoIssuerClient(cli.issuerUrl).createDemoTransfer({
      sender_strkey: cli.sender,
      recipient_strkey: cli.recipient,
      amount: cli.amount,
      corridor_id: cli.corridorId,
      source_country: "US",
      dest_country: "MX",
    });
  } else {
    throw new Error("provide --package <path> or --fetch with transfer fields\n\n" + usage());
  }

  if (!pkg.roots || !pkg.transfer) {
    throw new Error("package missing roots or transfer");
  }

  const proven = cli.provenPath ? loadJson<ProvenTransfer>(cli.provenPath) : undefined;
  const nullifier =
    proven?.nullifier ??
    (pkg.public_inputs?.nullifier != null ? String(pkg.public_inputs.nullifier) : undefined);
  if (!nullifier) {
    throw new Error("nullifier required — pass --proven or ensure package has public_inputs.nullifier");
  }

  const issuerPk = client.cfg.issuerPublicKey;
  if (!issuerPk) throw new Error("ISSUER_PUBLIC_KEY not set");

  const computed = await fetchComputedRoots(cli.issuerUrl, cli.issuerToken, cli.corridorId);
  const chain = await getLatestChainRoots(client.cfg, issuerPk, cli.corridorId).catch(() => null);

  const pkgRoots = pkg.roots as RootsRecord;
  const fromPackage = buildVector(pkgRoots, pkg, nullifier);
  const fromIssuer = buildVector(computed.computed_roots, pkg, nullifier);
  const fromChain = chain ? buildVector(rootsFromChain(chain), pkg, nullifier) : undefined;
  const provenVector = proven ? vectorFromSignals(proven.publicSignals) : undefined;

  console.log("Public input diff");
  console.log(`  compliance: ${client.cfg.complianceId ?? "(unset)"}`);
  console.log(`  issuer:     ${issuerPk}`);
  console.log(`  corridor:   ${cli.corridorId}`);
  if (computed.snapshot_meta) {
    console.log(`  snapshot:   ${JSON.stringify(computed.snapshot_meta)}`);
  }
  if (chain) {
    console.log(
      `  chain:      issuer@${chain.issuer.ledger} (${chain.issuer.eventTopic}), corridor@${chain.corridor.ledger} (${chain.corridor.eventTopic})`,
    );
  } else {
    console.log("  chain:      (no matching issuer/corridor events found in recent ledgers)");
  }

  const header = [
    "idx",
    "field",
    ...(provenVector ? ["proven"] : []),
    "package",
    "issuer",
    ...(fromChain ? ["chain"] : []),
    "match",
  ];
  console.log("\n" + header.join("\t"));

  let mismatchCount = 0;
  for (const [index, field] of PUBLIC_INPUT_FIELDS.entries()) {
    const cols = [
      String(index),
      field,
      ...(provenVector ? [shortDecimal(provenVector[index]!)] : []),
      shortDecimal(fromPackage[index]!),
      shortDecimal(fromIssuer[index]!),
      ...(fromChain ? [shortDecimal(fromChain[index]!)] : []),
    ];

    const reference = fromChain ?? fromIssuer;
    const rowMatches =
      (!provenVector || provenVector[index] === reference[index]) &&
      fromPackage[index] === reference[index];
    if (!rowMatches) mismatchCount += 1;
    cols.push(rowMatches ? "ok" : "MISMATCH");
    console.log(cols.join("\t"));
  }

  printRecommendations({
    proven: provenVector,
    fromPackage,
    fromChain,
    fromIssuer,
    pkgRoots,
    computedRoots: computed.computed_roots,
    chainRoots: chain ? rootsFromChain(chain) : undefined,
    snapshotRoots: computed.latest_root_snapshot,
  });

  if (provenVector && fromChain && !publicSignalsMatch(provenVector, fromChain)) {
    console.error(
      `\nFAIL: proven public inputs do not match on-chain rebuild (${mismatchCount} field rows flagged).`,
    );
    process.exit(1);
  }

  if (provenVector && !fromChain && !publicSignalsMatch(provenVector, fromIssuer)) {
    console.error("\nWARN: proven inputs mismatch issuer-computed rebuild (chain roots unavailable).");
    process.exit(1);
  }

  console.log("\nOK: no proven-vs-chain mismatch detected.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
