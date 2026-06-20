import type { CorridorOption, ProofPackage, ProofPackageRequest } from "@wisp_/js";

export interface IssuerWellKnown {
  api_version: string;
  protocol_version?: string;
  issuer_stellar_address: string;
  metadata_uri?: string;
  service_url?: string;
  compliance_contract_id?: string;
  verifier_contract_id?: string;
  circuit_vk_hash?: string;
  proof_package_schema: number;
  network_passphrase?: string;
}

export interface CorridorDetail {
  corridor_id: number;
  name: string;
  source_country: string;
  dest_country: string;
  enabled: boolean;
  asset_hex: string;
  latest_root_snapshot?: unknown;
}

/** Minimal issuer surface for plug-and-play SDK integration. */
export interface IssuerAdapter {
  createProofPackage(req: ProofPackageRequest): Promise<ProofPackage>;
  listCorridors?(): Promise<CorridorOption[]>;
  getCorridor?(id: number): Promise<CorridorDetail>;
  getWellKnown?(): Promise<IssuerWellKnown>;
}

export type { ProofPackageRequest };
