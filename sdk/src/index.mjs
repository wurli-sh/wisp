import { loadConfig } from "./config.mjs";
import { IssuerClient } from "./issuer-client.mjs";
import { proveFromPackage } from "./prover.mjs";
import { settleWithKeypair, settleWithWallet, simulateSettle } from "./settle.mjs";
import { auditNullifier } from "./audit.mjs";
import { fieldDecimalToBytes32 } from "./field.mjs";

export class AmoebaClient {
  /** @param {ReturnType<typeof loadConfig>} cfg */
  constructor(cfg) {
    this.cfg = cfg;
    this.issuer = new IssuerClient(cfg.issuerUrl);
  }

  static fromEnv(overrides = {}) {
    return new AmoebaClient(loadConfig(overrides));
  }

  async prove(input = {}) {
    const pkg = input.package ?? (await this.issuer.getDemoTransfer());
    const cfg = {
      ...this.cfg,
      ...(input.artifactDir ? { artifactDir: input.artifactDir } : {}),
      ...(input.zkeyPath ? { zkeyPath: input.zkeyPath } : {}),
    };
    return proveFromPackage(pkg, cfg);
  }

  settleWithKeypair(proven, pkg, secret) {
    return settleWithKeypair(proven, pkg, this.cfg, secret);
  }

  settleWithWallet(proven, pkg, wallet) {
    return settleWithWallet(proven, pkg, this.cfg, wallet);
  }

  simulateSettle(proven, pkg, publicKey) {
    return simulateSettle(proven, pkg, this.cfg, publicKey);
  }

  async audit(nullifierDecimal, publicKey) {
    const bytes = fieldDecimalToBytes32(nullifierDecimal);
    const attested = await auditNullifier(bytes, this.cfg, publicKey);
    return { attested, nullifier: bytes.toString("hex") };
  }
}

export { loadConfig } from "./config.mjs";
export { serializeSnarkjsProof } from "./serialize.mjs";
export { fieldDecimalToBytes32, normalizeField } from "./field.mjs";
