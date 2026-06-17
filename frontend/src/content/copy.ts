export interface HeroCta {
  readonly label: string;
  readonly href: string;
}

export const COPY = {
  hero: {
    eyebrow: "ZK-COMPLIANCE FOR CROSS-BORDER STELLAR STABLECOINS",
    headlineLead: "Prove every transfer. Keep personal info",
    headlineAccent: "private.",
    sub: "Cross-border corridor compliance on Stellar. Customer credentials stay off-chain.",
    ctas: {
      primary: { label: "See a live proof →", href: "/demo" },
      secondary: { label: "How it works", href: "#how-it-works" },
    },
  },

  paradoxAct: {
    eyebrow: "PUBLIC-CHAIN COMPLIANCE STILL FORCES A BAD TRADEOFF",
    headline: "Every transfer needs proof.",
    headlineAccent: "Not paperwork.",
    closer: "Compliance evidence and customer privacy — one rail.",
    withoutZk: {
      label: "Manual compliance",
      tagline: "Sensitive customer data follows the payment",
      rows: [
        { field: "Recipient", value: "GDKT…4H2P" },
        { field: "Tax ID", value: "489-32-7104" },
        { field: "Country", value: "US (from KYC file)" },
        { field: "Amount", value: "$50,000.00 USDC" },
      ],
      pill: "HIGH DATA RISK · FRAGMENTED AUDIT",
    },
    withZk: {
      label: "Amoeba rail",
      tagline: "Proof settles with the transfer, credentials stay off-chain",
      rows: [
        { field: "Recipient", value: "GDKT…4H2P", revealed: true },
        { field: "Tax ID", value: "Groth16 membership", revealed: false },
        { field: "Country", value: "Jurisdiction proven", revealed: false },
        { field: "Amount", value: "$50,000.00 USDC", revealed: true },
      ],
      pill: "COMPLIANT · VERIFIED",
      caption: "Both move money. Only one leaves reusable proof.",
    },
  },

  whatItProves: {
    eyebrow: "WHAT EVERY TRANSFER PROVES",
    headline: "Eight checks.",
    sub: "Transfers stay visible. Credentials stay private.",
    checks: [
      { name: "KYC membership", detail: "Sender is in the issuer's verified-user Merkle tree." },
      { name: "Nullifier binding", detail: "Each transfer gets a unique anti-replay nullifier." },
      { name: "Sanctions exclusion", detail: "Sender is not in the OFAC sanctions tree." },
      { name: "Jurisdiction", detail: "Sender's KYC jurisdiction is allowed for the corridor." },
      { name: "Credential expiry", detail: "KYC credential is still valid at proof time." },
      { name: "Corridor source", detail: "Sender jurisdiction matches the corridor source (e.g. US)." },
      { name: "Corridor destination", detail: "Recipient is in the corridor destination registry." },
      { name: "Corridor binding", detail: "On-chain corridor config hash matches the proof." },
    ],
  },

  engine: {
    eyebrow: "How it works",
    headline: "Verify once. Prove anywhere. Settle forever.",
    chapters: [
      {
        title: "Verify once.",
        kicker: "identity intake",
        body: "An issuer verifies once and publishes a root on-chain. The document does not travel with the payment.",
        benchmarks: [
          { value: "1", label: "Credential" },
          { value: "0", label: "PII on ledger" },
        ],
      },
      {
        title: "Prove anywhere.",
        kicker: "local proving",
        body: "The browser generates a fresh proof for the sender, recipient, corridor, asset, and amount.",
        benchmarks: [
          { value: "<5s", label: "Proof generation" },
          { value: "256B", label: "Proof size" },
        ],
      },
      {
        title: "Settle forever.",
        kicker: "on-chain verification",
        body: "Soroban verifies the proof, records the nullifier, and gates the SAC transfer via the compliance contract.",
        benchmarks: [
          { value: "<$0.001", label: "Verify cost" },
          { value: "8", label: "Checks in one proof" },
        ],
      },
    ],
  },

  builders: {
    eyebrow: "WHY BUILDERS CARE",
    headline: "Ship the rail, not another compliance backlog.",
    sub: "Corridor policy, issuer credentials, proof settlement, and audit evidence in one rail.",
    featuredNote: "US→MX corridor live on Stellar testnet",
    benefits: [
      {
        name: "Faster integration",
        stat: "1",
        statLabel: "Shared rail",
        body: "Reuse one compliance flow instead of rebuilding checks per product.",
        tags: ["SDK", "Demo"],
      },
      {
        name: "Corridor logic included",
        stat: "8",
        statLabel: "Checks per proof",
        body: "Bind sender, recipient, corridor, asset, and amount in one proof.",
        tags: ["Travel rule", "Policy"],
      },
      {
        name: "Less exposed data",
        stat: "0",
        statLabel: "Raw PII on-chain",
        body: "Keep credentials off-chain while preserving compliance evidence.",
        tags: ["Privacy", "GDPR"],
      },
      {
        name: "Portable credentials",
        stat: "1",
        statLabel: "Issuer verification",
        body: "Verify once with an issuer, then reuse the credential across transfers.",
        tags: ["Anchors", "SEP-24"],
      },
      {
        name: "Audit-ready settlement",
        stat: "∞",
        statLabel: "Replayable trail",
        body: "Nullifiers and events leave an auditable trail without the documents.",
        tags: ["Audit", "Soroban"],
      },
    ],
  },

  sdk: {
    eyebrow: "SDK",
    headline: "See the rail. Then integrate it.",
    headlineLead: "See the rail.",
    headlineAccent: "Then integrate it.",
    sub: "One TypeScript client to prove in the browser, settle with Freighter, and replay the audit trail.",
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
    headline: "A reusable compliance credential for every transfer.",
    sub: "Complete issuer verification once. Every transfer after carries its own proof without exposing the customer record.",
    subLead: "Complete issuer verification once. Every transfer after carries its own proof, like a",
    subAccent: "compliance credential",
    subTail: "that travels with the payment, not the customer record.",
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
      headline: "Stop rebuilding regulated transfer flows from scratch.",
      sub: "Open the demo to watch a proof generate, settle on Stellar, and leave an audit trail.",
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
    kyc: {
      title: "SEP-10 wallet verification",
      subtitle: "Sign a challenge in Freighter to bind your wallet. Demo policy assigns a US-approved sender profile — no identity form.",
      required: "KYC required",
      approved: "KYC approved",
      revoked: "KYC revoked",
      approvedHint: "Your wallet is approved for demo transfers.",
      revokedHint: "This wallet was revoked by the issuer operator. Contact support to restore access.",
      rejected: "KYC rejected",
      rejectedHint:
        "Wallet verification failed. Retry signing the challenge in Freighter.",
      submit: "Sign wallet challenge",
      connectFirst: "Connect Freighter before signing the challenge.",
      missing: {
        kyc: "Complete SEP-10 wallet verification for this wallet.",
        destination: "Operator must approve the recipient destination.",
        roots: "Operator must publish issuer roots.",
        corridor: "No enabled corridor is configured.",
        sender_corridor: "Sender jurisdiction is not eligible for the selected corridor.",
      },
      wizard: {
        title: "SEP-10 wallet verification",
        subtitle: "Prove wallet control on testnet",
        steps: {
          setup: "Setup",
          verify: "Sign",
          done: "Done",
        },
        demoPolicy:
          "Demo policy: after wallet verification the issuer assigns a US-approved sender profile (jurisdiction US, sanctions clear). This is not production identity verification.",
        features: [
          { label: "Wallet-bound credential", detail: "SEP-10 challenge signed in Freighter" },
          { label: "Issuer Merkle membership", detail: "Proves eligibility without exposing PII" },
          { label: "US corridor eligibility", detail: "Backend assigns US→MX corridor access" },
        ],
        intro:
          "Sign a one-time challenge to prove you control this wallet. The issuer then assigns a demo-approved sender profile for compliant transfers.",
        start: "Sign challenge",
        skip: "Skip for now",
        signing: "Sign in Freighter...",
        signingHint: "No fee — just a signature to verify wallet ownership",
        submitting: "Verifying wallet...",
        doneTitle: "Wallet verified",
        doneSubtitle: "Demo sender profile assigned. Fetch a proof package and settle a compliant transfer.",
        continueTransfer: "Continue to transfer",
        reopen: "Verify wallet",
        retry: "Retry verification",
        rejectedBanner: "Your last verification attempt was rejected.",
        rejectedRequirements: "Ensure you sign the challenge with the connected Freighter account.",
      },
    },
    transfer: {
      title: "Transfer",
      youSend: "You send",
      amountLabel: "Amount (USDC)",
      recipient: "Recipient",
      recipientPlaceholder: "G...",
      recipientHint: "Use the pre-filled demo recipient (MX corridor registry).",
      sourceCountry: "Source country",
      destCountry: "Destination country",
      corridor: "Corridor",
      asset: "USDC",
      complianceDetails: "Compliance",
      corridorId: "Corridor",
      nullifier: "Nullifier",
      transaction: "Transaction",
      connectWallet: "Connect Freighter",
      refreshPackage: "Refresh proof package",
      fetchPackage: "Fetch proof package",
      proofStatus: "Proof status",
      proofReady: "Ready",
      proofPending: "Not generated",
    },
    steps: [
      "Wallet connected",
      "Wallet verified (SEP-10)",
      "Corridor selected",
      "Recipient entered",
      "Amount entered",
      "Proof package fetched",
      "Proof generated",
      "SAC allowance approved",
      "Transaction simulated",
      "Transaction submitted",
      "Transfer confirmed",
      "Audit event shown",
    ],
    actions: {
      generateProof: "Generate proof",
      approveSac: "Approve USDC allowance",
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
      "Amoeba is ZK-compliance infrastructure for cross-border Stellar stablecoins: private credentials and auditable settlement in one flow.",
    highlight: "Stellar.",
  },
} as const;
