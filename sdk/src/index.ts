import { loadConfig, type AmoebaConfig } from "./config.js";
import { IssuerClient } from "./issuer/client.js";
import { proveFromPackage, type ProvenTransfer } from "./prove/prover.js";
import {
  settleWithKeypair,
  settleWithWallet,
  simulateSettle,
  type WalletSigner,
} from "./settle/compliant-transfer.js";
import { auditNullifier } from "./audit/index.js";
import { fieldDecimalToBytes32, normalizeField } from "./settle/encoding.js";
import type { ProofPackage } from "@amoeba/js";

export class AmoebaClient {
  readonly cfg: AmoebaConfig;
  readonly issuer: IssuerClient;

  constructor(cfg: AmoebaConfig) {
    this.cfg = cfg;
    this.issuer = new IssuerClient(cfg.issuerUrl);
  }

  static fromEnv(overrides: Record<string, string | undefined> = {}): AmoebaClient {
    return new AmoebaClient(loadConfig(overrides));
  }

  async prove(input: {
    package?: ProofPackage;
    artifactDir?: string;
    zkeyPath?: string;
  } = {}): Promise<ProvenTransfer> {
    const pkg = input.package ?? (await this.issuer.getDemoTransfer());
    const cfg: AmoebaConfig = {
      ...this.cfg,
      ...(input.artifactDir ? { artifactDir: input.artifactDir } : {}),
      ...(input.zkeyPath ? { zkeyPath: input.zkeyPath } : {}),
    };
    return proveFromPackage(pkg, cfg);
  }

  settleWithKeypair(proven: ProvenTransfer, pkg: ProofPackage, secret: string) {
    return settleWithKeypair(proven, pkg, this.cfg, secret);
  }

  settleWithWallet(proven: ProvenTransfer, pkg: ProofPackage, wallet: WalletSigner) {
    return settleWithWallet(proven, pkg, this.cfg, wallet);
  }

  simulateSettle(proven: ProvenTransfer, pkg: ProofPackage, publicKey: string) {
    return simulateSettle(proven, pkg, this.cfg, publicKey);
  }

  async audit(nullifierDecimal: string, publicKey: string) {
    const bytes = fieldDecimalToBytes32(nullifierDecimal);
    const attested = await auditNullifier(bytes, this.cfg, publicKey);
    return { attested, nullifier: bytes.toString("hex") };
  }
}

export { loadConfig } from "./config.js";
export { loadAmoebaEnv } from "./env.js";
export { serializeSnarkjsProof } from "./prove/serialize.js";
export { fieldDecimalToBytes32, normalizeField } from "./settle/encoding.js";
