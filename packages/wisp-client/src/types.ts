export interface ChainClientConfig {
  rpcUrl: string;
  networkPassphrase: string;
  verifierId?: string;
  complianceId?: string;
  issuerPublicKey?: string;
  issuerUrl?: string;
  validateStartLedger?: number;
}
