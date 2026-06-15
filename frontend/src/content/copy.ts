export interface HeroCta {
  readonly label: string;
  readonly href: string;
}

export const COPY = {
  hero: {
    eyebrow: "COMPLIANCE FOR PROGRAMMABLE MONEY",
    headline: "Prove without showing.",
    sub: "Stablecoins moved $9.3T last year. Compliance is still spreadsheets. Amoeba lets every Stellar transfer carry its own audit — cryptographic, instant, private credentials.",
    ctas: {
      primary: { label: "See a live proof →", href: "/demo" },
      secondary: { label: "How it works", href: "#how-it-works" },
    },
  },

  paradoxAct: {
    eyebrow: "$9T moved in 2025. Until now, only one option.",
    headline: "Same transaction. Two realities.",
    closer: "Compliance and privacy — one proof.",
    withoutZk: {
      label: "Without ZK",
      rows: ["Recipient", "Tax ID", "Country", "Amount"],
      pill: "VIOLATES GDPR · LGPD · MiCA",
    },
    withZk: {
      label: "With ZK",
      pill: "COMPLIANT · VERIFIED",
      caption: "Both prove the user is verified. Only one can stand in court.",
    },
  },

  engine: {
    eyebrow: "How it works",
    headline: "Verify once. Prove anywhere. Settle forever.",
    chapters: [
      {
        title: "Verify once.",
        kicker: "identity intake",
        body: "KYC issuer signs once. The Merkle root goes on-chain via Soroban. You never expose a document again.",
        benchmarks: [
          { value: "1", label: "Credential" },
          { value: "0", label: "PII on ledger" },
        ],
      },
      {
        title: "Prove anywhere.",
        kicker: "local proving",
        body: "The browser generates a Groth16 proof in <5s. No server. No trust assumption.",
        benchmarks: [
          { value: "<5s", label: "Proof generation" },
          { value: "256B", label: "Proof size" },
        ],
      },
      {
        title: "Settle forever.",
        kicker: "on-chain verification",
        body: "The compliance contract verifies in Soroban, records a nullifier, and gates the SAC transfer. Audit trail lives forever.",
        benchmarks: [
          { value: "<$0.001", label: "Verify cost" },
          { value: "8", label: "Checks in one proof" },
        ],
      },
    ],
  },

  useCases: {
    eyebrow: "USE CASES",
    headline: "One primitive. Five markets.",
    sub: "One Groth16 proof gates every flow below.",
    featuredNote: "US→MX · Stellar testnet",
    markets: [
      {
        name: "Travel rule",
        stat: "$9T",
        statLabel: "Stablecoin vol.",
        body: "Corridor compliance without tax IDs or passport data on-chain.",
        tags: ["GENIUS Act", "MiCA", "US→MX"],
      },
      {
        name: "Proof of solvency",
        stat: "$5T",
        statLabel: "Lending TAM",
        body: "Prove reserves and ratios without opening your book.",
        tags: ["DeFi", "RWA"],
      },
      {
        name: "ZK credit score",
        stat: "0",
        statLabel: "PII exposed",
        body: "Underwrite on history and behavior — not government ID.",
        tags: ["Lending", "Neobanks"],
      },
      {
        name: "AML by behavior",
        stat: "100%",
        statLabel: "Trail auditable",
        body: "Prove a clean pattern without linking wallet to identity.",
        tags: ["AML", "Privacy"],
      },
      {
        name: "Proof of reserves",
        stat: "$300B",
        statLabel: "RWA market",
        body: "Attest backing exists. Hide custody and position size.",
        tags: ["Stablecoins", "Custody"],
      },
    ],
  },

  sdk: {
    eyebrow: "SDK",
    headline: "Three lines of code.",
    sub: "One TypeScript client — prove in the browser, settle with Freighter, audit from chain events.",
    tabs: [
      { id: "pnpm", label: "pnpm", command: "pnpm add @amoeba/sdk" },
      { id: "npm", label: "npm", command: "npm install @amoeba/sdk" },
      { id: "yarn", label: "yarn", command: "yarn add @amoeba/sdk" },
      { id: "bun", label: "bun", command: "bun add @amoeba/sdk" },
      { id: "quickstart", label: "quickstart", command: "" },
    ],
    snippet: `import { AmoebaClient } from "@amoeba/sdk";

const client = AmoebaClient.fromEnv();
const proven = await client.prove({ package, browser: true });
await client.settleWithWallet(proven, pkg, wallet);`,
    stats: [
      { value: "<5s", label: "Browser proving" },
      { value: "256B", label: "Proof size" },
      { value: "8", label: "Checks in one proof" },
    ],
  },

  complianceCard: {
    headline: "A visa for compliant money.",
    sub: "Complete KYC once. Every transfer after carries its own cryptographic proof — like a prepaid compliance card for Stellar stablecoins. Credentials stay off-chain; the ledger only sees verified outcomes.",
    card: {
      brand: "Amoeba",
      network: "Stellar",
      holder: "verified-sender",
      pan: "4532 •••• •••• 0420",
      corridor: "US → MX",
      status: "COMPLIANT",
      proof: "Groth16 · 8 checks",
    },
    perks: [
      {
        label: "Verify once",
        detail: "Issuer signs your credential. Merkle root goes on-chain. You never upload documents again.",
      },
      {
        label: "Prove anywhere",
        detail: "Generate a fresh Groth16 proof in the browser for every corridor-compliant transfer.",
      },
      {
        label: "Audit forever",
        detail: "Nullifiers and ProofSettled events on Soroban — replayable by anyone with a tx hash.",
      },
    ],
  },

  move: {
    closer: {
      headline: "Compliance is no longer a six-month moat.",
      sub: "It's an SDK. Integrate in an afternoon. Pay per proof.",
      ctas: {
        primary: { label: "Open demo →", href: "/demo" },
        secondary: { label: "View on GitHub", href: "https://github.com/amoeba-zk/amoeba" },
      },
    },
  },

  nav: {
    links: [
      { label: "Home", href: "/" },
      { label: "Demo", href: "/demo" },
      { label: "Compliance", href: "/compliance" },
    ],
    wallet: { connect: "Connect Wallet", choose: "Choose Wallet" },
  },

  compliance: {
    proofs: {
      title: "Proof settlements",
      subtitle: "Live feed of settlement events. Every row carries a proof; every proof is replayable.",
    },
    audit: {
      title: "Audit lookup",
      subtitle: "Search by transaction hash or nullifier.",
      txPlaceholder: "Transaction hash",
      nullifierPlaceholder: "Nullifier (hex)",
      search: "Search",
    },
    corridors: {
      title: "Corridors",
      subtitle: "Travel-rule corridors enforced by the circuit.",
    },
  },

  demo: {
    title: "Generate a compliant transfer",
    honesty: "Real protocol. Outcomes come from Soroban — not mocked success.",
    steps: [
      "Wallet connected",
      "Demo sender funded",
      "Corridor selected",
      "Recipient entered",
      "Amount entered",
      "Proof package fetched",
      "Proof generated",
      "Transaction simulated",
      "Transaction submitted",
      "Transfer confirmed",
      "Audit event shown",
    ],
    actions: {
      generateProof: "Generate proof",
      submit: "Submit compliant transfer",
      invalid: "Try invalid proof",
      replay: "Replay last proof",
      audit: "View audit event",
    },
  },

  network: {
    label: "Stellar testnet",
    wrongNetwork: "Wrong network — Amoeba runs on Stellar testnet.",
    switch: "Switch network",
    switching: "Switching…",
  },

  footer: {
    blurb:
      "It's an SDK. Integrate in an afternoon. Pay per proof. ZK compliance for Stellar stablecoins — credentials stay private, every transfer stays auditable.",
    highlight: "Stellar.",
  },
} as const;
