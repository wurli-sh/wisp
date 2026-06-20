/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STELLAR_RPC_URL?: string;
  readonly VITE_NETWORK_PASSPHRASE?: string;
  readonly VITE_VERIFIER_CONTRACT_ID?: string;
  readonly VITE_COMPLIANCE_CONTRACT_ID?: string;
  readonly VITE_SAC_CONTRACT_ID?: string;
  readonly VITE_ISSUER_PUBLIC_KEY?: string;
  readonly VITE_ISSUER_URL?: string;
  readonly VITE_WISP_FIXTURE_PROFILE?: string;
  readonly VITE_WISP_WASM_URL?: string;
  readonly VITE_WISP_ZKEY_URL?: string;
  readonly VITE_WISP_DEMO_FIXTURE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
