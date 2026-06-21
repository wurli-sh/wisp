/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STELLAR_RPC_URL?: string;
  readonly VITE_NETWORK_PASSPHRASE?: string;
  readonly VITE_VERIFIER_CONTRACT_ID?: string;
  readonly VITE_COMPLIANCE_CONTRACT_ID?: string;
  readonly VITE_SAC_CONTRACT_ID?: string;
  readonly VITE_ISSUER_PUBLIC_KEY?: string;
  readonly VITE_ISSUER_URL?: string;
  readonly VITE_ISSUER_ADMIN_TOKEN?: string;
  readonly VITE_VALIDATE_START_LEDGER?: string;
  readonly VITE_COMPLIANCE_DEPLOY_LEDGER?: string;
  readonly VITE_WISP_FIXTURE_PROFILE?: string;
  readonly VITE_WISP_WASM_URL?: string;
  readonly VITE_WISP_ZKEY_URL?: string;
  readonly VITE_WISP_DEMO_FIXTURE_URL?: string;
  readonly VITE_WISP_DEBUG?: string;
  /** @deprecated use VITE_WISP_* */
  readonly VITE_AMOEBA_FIXTURE_PROFILE?: string;
  readonly VITE_AMOEBA_WASM_URL?: string;
  readonly VITE_AMOEBA_ZKEY_URL?: string;
  readonly VITE_AMOEBA_DEMO_FIXTURE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "country-flag-icons/string/3x2/*" {
  const svg: string;
  export default svg;
}
