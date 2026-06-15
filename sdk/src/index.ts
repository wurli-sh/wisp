import { loadConfig, type AmoebaConfig } from "./config.js";
import { IssuerClient } from "./issuer/client.js";
import { proveFromPackageBrowser } from "./prove/browser.js";
import { proveFromPackage, type ProvenTransfer } from "./prove/prover.js";
import {
  settleWithKeypair,
  settleWithWallet,
  simulateSettle,
  type WalletSigner,
} from "./settle/compliant-transfer.js";
import { auditNullifier } from "./audit/index.js";
import {
  getProofSettledByNullifier,
  getProofSettledByTxHash,
  listProofSettledEvents,
  type ProofSettledEvent,
} from "./audit/events.js";
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
    browser?: boolean;
    wasmUrl?: string;
    zkeyUrl?: string;
  } = {}): Promise<ProvenTransfer> {
    const pkg = input.package ?? (await this.issuer.getDemoTransfer());
    const cfg: AmoebaConfig = {
      ...this.cfg,
      ...(input.artifactDir ? { artifactDir: input.artifactDir } : {}),
      ...(input.zkeyPath ? { zkeyPath: input.zkeyPath } : {}),
    };

    if (input.browser) {
      const wasmUrl = input.wasmUrl ?? cfg.wasmUrl;
      const zkeyUrl = input.zkeyUrl ?? cfg.zkeyUrl;
      if (!wasmUrl || !zkeyUrl) {
        throw new Error("browser prove requires wasmUrl and zkeyUrl");
      }
      return proveFromPackageBrowser(pkg, { wasmUrl, zkeyUrl });
    }

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
    const event = await getProofSettledByNullifier(this.cfg, bytes.toString("hex")).catch(
      () => null,
    );
    return {
      attested,
      nullifier: bytes.toString("hex"),
      event,
    };
  }

  listProofSettledEvents(opts?: { limit?: number; startLedger?: number }) {
    return listProofSettledEvents(this.cfg, opts);
  }

  getProofSettledByTxHash(txHash: string) {
    return getProofSettledByTxHash(this.cfg, txHash);
  }

  getProofSettledByNullifier(nullifierHex: string) {
    return getProofSettledByNullifier(this.cfg, nullifierHex);
  }
}

export { loadConfig } from "./config.js";
export { loadAmoebaEnv } from "./env.js";
export { serializeSnarkjsProof } from "./prove/serialize.js";
export { fieldDecimalToBytes32, normalizeField } from "./settle/encoding.js";
export type { ProofSettledEvent };
export type { WalletSigner } from "./settle/compliant-transfer.js";
export type { ProvenTransfer } from "./prove/prover.js";
export type { DemoStrkeys } from "./config.js";
