import type { ProofPackage } from "@amoeba_/js";
import {
  AmoebaClient,
  HttpIssuerAdapter,
  type IssuerAdapter,
  type IssuerWellKnown,
  type ProvenTransfer,
  type ValidatePackageResult,
} from "@amoeba_/sdk";

interface ConformanceClientLike {
  issuer: IssuerAdapter;
  validatePackage(
    pkg: ProofPackage,
    opts: {
      issuerPublicKey: string;
      corridorId: number;
      strict?: boolean;
      wellKnownVkHash?: string;
    },
  ): Promise<ValidatePackageResult>;
  prove(input: { package: ProofPackage }): Promise<ProvenTransfer>;
  simulateSettle(
    proven: ProvenTransfer,
    pkg: ProofPackage,
    publicKey: string,
  ): Promise<unknown>;
}

export interface RunIssuerConformanceOptions {
  issuerUrl: string;
  issuerPublicKey: string;
  sender: string;
  recipient: string;
  amount?: string;
  corridorId?: number;
  strict?: boolean;
  skipProve?: boolean;
  simulateSettle?: boolean;
  simulationPublicKey?: string;
}

export interface IssuerConformanceResult {
  wellKnown: IssuerWellKnown;
  proofPackage: ProofPackage;
  validation: ValidatePackageResult;
  proven?: ProvenTransfer;
  simulated?: unknown;
}

export interface RunIssuerConformanceDeps {
  client?: ConformanceClientLike;
}

export async function runIssuerConformance(
  options: RunIssuerConformanceOptions,
  deps: RunIssuerConformanceDeps = {},
): Promise<IssuerConformanceResult> {
  const client =
    deps.client ??
    new AmoebaClient(
      {
        ...AmoebaClient.fromEnv({ ISSUER_URL: options.issuerUrl }).cfg,
        issuerUrl: options.issuerUrl,
      },
      new HttpIssuerAdapter(options.issuerUrl),
    );

  if (!client.issuer.getWellKnown) {
    throw new Error("issuer adapter missing getWellKnown");
  }

  const wellKnown = await client.issuer.getWellKnown();
  const proofPackage = await client.issuer.createProofPackage({
    sender_wallet: options.sender,
    recipient_wallet: options.recipient,
    amount: options.amount ?? "10000000",
    corridor_id: options.corridorId ?? 1,
  });

  const validation = await client.validatePackage(proofPackage, {
    issuerPublicKey: options.issuerPublicKey,
    corridorId: options.corridorId ?? 1,
    strict: options.strict,
    wellKnownVkHash: wellKnown.circuit_vk_hash,
  });

  let proven: ProvenTransfer | undefined;
  if (!options.skipProve) {
    proven = await client.prove({ package: proofPackage });
  }

  let simulated: unknown;
  if (options.simulateSettle) {
    if (!proven) {
      throw new Error("simulateSettle requires prove; omit skipProve");
    }
    if (!options.simulationPublicKey) {
      throw new Error("simulationPublicKey required when simulateSettle is enabled");
    }
    simulated = await client.simulateSettle(proven, proofPackage, options.simulationPublicKey);
  }

  return {
    wellKnown,
    proofPackage,
    validation,
    proven,
    simulated,
  };
}
