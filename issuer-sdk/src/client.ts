import { Client as ComplianceClient, ComplianceError } from "@amoeba_/compliance";
import type { ClientOptions as ContractClientOptions } from "@stellar/stellar-sdk/contract";
import type {
  AmoebaIssuerConfig,
  IssuerMutationTransaction,
  IssuerTransactionSigner,
  PublishIssuerRootsInput,
  PublishRootsInput,
  PublishRootsPlan,
  PublishRootsSendResult,
  RegisterCorridorInput,
  RegisterIssuerInput,
  UpdateCorridorInput,
  UpdateIssuerMetadataInput,
} from "./types.js";
import { normalizeRootHashToBytes } from "./encoding.js";

interface ComplianceClientLike {
  get_issuer(args: { issuer: string }): Promise<{ result: unknown }>;
  get_corridor(args: { issuer: string; corridor_id: number }): Promise<{ result: unknown }>;
  register_issuer(args: {
    issuer: string;
    metadata_uri: string;
  }): Promise<IssuerMutationTransaction>;
  update_issuer_metadata(args: {
    issuer: string;
    metadata_uri: string;
  }): Promise<IssuerMutationTransaction>;
  register_corridor(args: {
    issuer: string;
    corridor_id: number;
    source_jurisdiction_root: Buffer;
    dest_address_root: Buffer;
    corridor_config_hash: Buffer;
  }): Promise<IssuerMutationTransaction>;
  update_corridor(args: {
    issuer: string;
    corridor_id: number;
    source_jurisdiction_root: Buffer;
    dest_address_root: Buffer;
    corridor_config_hash: Buffer;
    enabled: boolean;
  }): Promise<IssuerMutationTransaction>;
  update_issuer_root(args: {
    issuer: string;
    merkle_root: Buffer;
    sanctions_root: Buffer;
    jurisdiction_root: Buffer;
  }): Promise<IssuerMutationTransaction>;
}

export interface AmoebaIssuerClientOptions {
  contractFactory?: (options: ContractClientOptions) => ComplianceClientLike;
}

function isPresentOption(result: unknown): boolean {
  if (result === null || result === undefined) return false;
  if (Array.isArray(result)) return result.length > 0;
  if (typeof result === "object") {
    if ("tag" in result && (result as { tag?: unknown }).tag === "None") return false;
    if ("tag" in result && (result as { tag?: unknown }).tag === "Some") return true;
    if ("value" in result) return (result as { value?: unknown }).value !== undefined;
  }
  return true;
}

function sendErrorCode(error: unknown): number | null {
  const text =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);

  if (!text) {
    return null;
  }

  const directMatch = text.match(/#(\d+)/);
  if (directMatch) {
    return Number(directMatch[1]);
  }

  for (const [code, detail] of Object.entries(ComplianceError)) {
    const message =
      typeof detail === "object" && detail && "message" in detail
        ? String((detail as { message: string }).message)
        : "";
    if (message && text.includes(message)) {
      return Number(code);
    }
  }

  return null;
}

async function signAndSend(
  tx: IssuerMutationTransaction,
  signer: IssuerTransactionSigner,
): Promise<unknown> {
  const sent = await tx.signAndSend({ signTransaction: signer.signTransaction });
  // Force contract/send failures to surface before treating the operation as successful.
  void (sent as { result: unknown }).result;
  return sent;
}

export class AmoebaIssuerClient {
  readonly cfg: AmoebaIssuerConfig;
  private readonly contractFactory: (options: ContractClientOptions) => ComplianceClientLike;

  constructor(cfg: AmoebaIssuerConfig, options: AmoebaIssuerClientOptions = {}) {
    this.cfg = cfg;
    this.contractFactory =
      options.contractFactory ??
      ((contractOptions) => new ComplianceClient(contractOptions) as ComplianceClientLike);
  }

  private resolveIssuer(issuer?: string): string {
    const resolved = issuer ?? this.cfg.issuerPublicKey;
    if (!resolved) {
      throw new Error("issuer is required");
    }
    return resolved;
  }

  private contract(publicKey = this.cfg.operatorPublicKey): ComplianceClientLike {
    return this.contractFactory({
      contractId: this.cfg.complianceId,
      rpcUrl: this.cfg.rpcUrl,
      networkPassphrase: this.cfg.networkPassphrase,
      publicKey,
    });
  }

  async registerIssuer(
    input: RegisterIssuerInput,
    publicKey = this.cfg.operatorPublicKey,
  ): Promise<IssuerMutationTransaction> {
    return this.contract(publicKey).register_issuer({
      issuer: this.resolveIssuer(input.issuer),
      metadata_uri: input.metadataUri,
    });
  }

  async registerIssuerAndSend(
    input: RegisterIssuerInput,
    signer: IssuerTransactionSigner,
  ): Promise<unknown> {
    const tx = await this.registerIssuer(input, signer.publicKey);
    return signAndSend(tx, signer);
  }

  async updateIssuerMetadata(
    input: UpdateIssuerMetadataInput,
    publicKey = this.cfg.operatorPublicKey,
  ): Promise<IssuerMutationTransaction> {
    return this.contract(publicKey).update_issuer_metadata({
      issuer: this.resolveIssuer(input.issuer),
      metadata_uri: input.metadataUri,
    });
  }

  async updateIssuerMetadataAndSend(
    input: UpdateIssuerMetadataInput,
    signer: IssuerTransactionSigner,
  ): Promise<unknown> {
    const tx = await this.updateIssuerMetadata(input, signer.publicKey);
    return signAndSend(tx, signer);
  }

  async registerCorridor(
    input: RegisterCorridorInput,
    publicKey = this.cfg.operatorPublicKey,
  ): Promise<IssuerMutationTransaction> {
    return this.contract(publicKey).register_corridor({
      issuer: this.resolveIssuer(input.issuer),
      corridor_id: input.corridorId,
      source_jurisdiction_root: normalizeRootHashToBytes(input.sourceJurisdictionRoot),
      dest_address_root: normalizeRootHashToBytes(input.destAddressRoot),
      corridor_config_hash: normalizeRootHashToBytes(input.corridorConfigHash),
    });
  }

  async registerCorridorAndSend(
    input: RegisterCorridorInput,
    signer: IssuerTransactionSigner,
  ): Promise<unknown> {
    const tx = await this.registerCorridor(input, signer.publicKey);
    return signAndSend(tx, signer);
  }

  async updateCorridor(
    input: UpdateCorridorInput,
    publicKey = this.cfg.operatorPublicKey,
  ): Promise<IssuerMutationTransaction> {
    return this.contract(publicKey).update_corridor({
      issuer: this.resolveIssuer(input.issuer),
      corridor_id: input.corridorId,
      source_jurisdiction_root: normalizeRootHashToBytes(input.sourceJurisdictionRoot),
      dest_address_root: normalizeRootHashToBytes(input.destAddressRoot),
      corridor_config_hash: normalizeRootHashToBytes(input.corridorConfigHash),
      enabled: input.enabled,
    });
  }

  async updateCorridorAndSend(
    input: UpdateCorridorInput,
    signer: IssuerTransactionSigner,
  ): Promise<unknown> {
    const tx = await this.updateCorridor(input, signer.publicKey);
    return signAndSend(tx, signer);
  }

  async publishIssuerRoots(
    input: PublishIssuerRootsInput,
    publicKey = this.cfg.operatorPublicKey,
  ): Promise<IssuerMutationTransaction> {
    return this.contract(publicKey).update_issuer_root({
      issuer: this.resolveIssuer(input.issuer),
      merkle_root: normalizeRootHashToBytes(input.merkleRoot),
      sanctions_root: normalizeRootHashToBytes(input.sanctionsRoot),
      jurisdiction_root: normalizeRootHashToBytes(input.jurisdictionRoot),
    });
  }

  async publishIssuerRootsAndSend(
    input: PublishIssuerRootsInput,
    signer: IssuerTransactionSigner,
  ): Promise<unknown> {
    const tx = await this.publishIssuerRoots(input, signer.publicKey);
    return signAndSend(tx, signer);
  }

  async planPublishRoots(
    input: PublishRootsInput,
    publicKey = this.cfg.operatorPublicKey,
  ): Promise<PublishRootsPlan> {
    const issuer = this.resolveIssuer(input.issuer);
    const contract = this.contract(publicKey);
    const issuerRecord = await contract.get_issuer({ issuer });
    const corridorRecord = await contract.get_corridor({
      issuer,
      corridor_id: input.corridorId,
    });

    return {
      issuer,
      corridorId: input.corridorId,
      registerIssuer: isPresentOption(issuerRecord.result)
        ? undefined
        : {
            action: "registerIssuer",
            build: (nextPublicKey = publicKey) =>
              this.registerIssuer({ issuer, metadataUri: input.metadataUri }, nextPublicKey),
          },
      publishIssuerRoots: {
        action: "publishIssuerRoots",
        build: (nextPublicKey = publicKey) =>
          this.publishIssuerRoots(
            {
              issuer,
              merkleRoot: input.merkleRoot,
              sanctionsRoot: input.sanctionsRoot,
              jurisdictionRoot: input.jurisdictionRoot,
            },
            nextPublicKey,
          ),
      },
      corridor: isPresentOption(corridorRecord.result)
        ? {
            action: "update",
            build: (nextPublicKey = publicKey) =>
              this.updateCorridor(
                {
                  issuer,
                  corridorId: input.corridorId,
                  sourceJurisdictionRoot: input.sourceJurisdictionRoot,
                  destAddressRoot: input.destAddressRoot,
                  corridorConfigHash: input.corridorConfigHash,
                  enabled: input.enabled ?? true,
                },
                nextPublicKey,
              ),
          }
        : {
            action: "register",
            build: (nextPublicKey = publicKey) =>
              this.registerCorridor(
                {
                  issuer,
                  corridorId: input.corridorId,
                  sourceJurisdictionRoot: input.sourceJurisdictionRoot,
                  destAddressRoot: input.destAddressRoot,
                  corridorConfigHash: input.corridorConfigHash,
                },
                nextPublicKey,
              ),
          },
    };
  }

  async publishRoots(
    input: PublishRootsInput,
    signer?: IssuerTransactionSigner,
  ): Promise<PublishRootsPlan | PublishRootsSendResult> {
    const plan = await this.planPublishRoots(input, signer?.publicKey ?? this.cfg.operatorPublicKey);
    if (!signer) {
      return plan;
    }

    let registerIssuerSent: unknown;
    if (plan.registerIssuer) {
      try {
        registerIssuerSent = await signAndSend(
          await plan.registerIssuer.build(signer.publicKey),
          signer,
        );
      } catch (error) {
        if (sendErrorCode(error) !== 20) {
          throw error;
        }
      }
    }

    const publishIssuerRootsSent = await signAndSend(
      await plan.publishIssuerRoots.build(signer.publicKey),
      signer,
    );

    let corridorSent: unknown;
    if (plan.corridor.action === "register") {
      try {
        corridorSent = await signAndSend(await plan.corridor.build(signer.publicKey), signer);
      } catch (error) {
        if (sendErrorCode(error) !== 21) {
          throw error;
        }
        const fallback = await this.updateCorridor(
          {
            issuer: plan.issuer,
            corridorId: plan.corridorId,
            sourceJurisdictionRoot: input.sourceJurisdictionRoot,
            destAddressRoot: input.destAddressRoot,
            corridorConfigHash: input.corridorConfigHash,
            enabled: input.enabled ?? true,
          },
          signer.publicKey,
        );
        corridorSent = await signAndSend(fallback, signer);
      }
    } else {
      corridorSent = await signAndSend(await plan.corridor.build(signer.publicKey), signer);
    }

    return {
      plan,
      sent: {
        registerIssuer: registerIssuerSent,
        publishIssuerRoots: publishIssuerRootsSent,
        corridor: corridorSent,
      },
    };
  }
}
