export const COPY = {
  hero: {
    eyebrow: "ZK COMPLIANCE FOR STELLAR STABLECOINS",
    headlineLead: "Stealth rails for",
    headlineAccent: "stablecoin compliance.",
    sub: "ZK compliance for cross-border Stellar stablecoins, with a portable SDK for any issuer.",
    ctas: {
      primary: { label: "Live demo →", href: "/demo" },
      secondary: { label: "How it works", href: "#how-it-works" },
    },
    showcase: [
      {
        eyebrow: "STEALTH LAYER",
        title: "ZK compliance for cross-border Stellar stablecoins.",
        body: "Corridor rules, sanctions checks, and settlement in one rail.",
        points: ["Cross-border corridors", "ZK-backed compliance", "Stellar settlement"],
      },
      {
        eyebrow: "PORTABLE SDK",
        title: "Portable issuer SDK for any anchor.",
        body: "Integrate credentials, roots, and transfers without issuer lock-in.",
        points: ["Any issuer", "Portable integration", "Browser prove + wallet settle"],
      },
    ],
  },

  paradoxAct: {
    eyebrow: "PRIVATE BY DEFAULT",
    headline: "Keep the proof.",
    headlineAccent: "Drop the data.",
    withoutZk: {
      label: "Manual compliance",
      tagline: "Customer data follows the payment",
      rows: [
        { field: "Recipient", value: "GDKT…4H2P" },
        { field: "Tax ID", value: "489-32-7104" },
        { field: "Country", value: "US (from KYC file)" },
        { field: "Amount", value: "$50,000.00 USDC" },
      ],
      pill: "HIGH RISK · FRAGMENTED AUDIT",
    },
    withZk: {
      label: "Wisp rail",
      tagline: "Proof settles. Data stays off-chain.",
      rows: [
        { field: "Recipient", value: "GDKT…4H2P", revealed: true },
        { field: "Tax ID", value: "Groth16 membership", revealed: false },
        { field: "Country", value: "Jurisdiction proven", revealed: false },
        { field: "Amount", value: "$50,000.00 USDC", revealed: true },
      ],
      pill: "COMPLIANT · VERIFIED",
      // caption: "Both move money. One leaves reusable proof.",
    },
  },

  engine: {
    eyebrow: "HOW WISP WORKS",
    headlineLead: "From issuer root",
    headlineAccent: "to compliant settlement.",
    pipeline: {
      issuer: {
        title: "Trusted Issuer",
        kicker: "identity intake",
        caption: "Issuer verifies the user and publishes a reusable root.",
        steps: [
          { label: "Verifying…", detail: "Document intake" },
          { label: "KYC complete", detail: "Credential issued" },
          { label: "Merkle root on-chain", detail: "0x7f3a…c21e" },
        ],
      },
      compliance: {
        title: "Wisp",
        kicker: "compliance layer",
        caption: "Wisp packages corridor rules into one browser proof.",
        steps: [
          { label: "Awaiting credential", detail: "Idle" },
          { label: "Generating proof…", detail: "Groth16 · BN254" },
          { label: "Proof ready", detail: "8 checks passed" },
        ],
        checks: [
          "KYC",
          "Nullifier",
          "Sanctions",
          "Jurisdiction",
          "Expiry",
          "Source",
          "Dest",
          "Corridor",
        ],
      },
      receiver: {
        title: "Recipient",
        kicker: "on-chain settlement",
        caption: "Soroban verifies the proof, records the nullifier, and settles.",
        steps: [
          { label: "Awaiting proof…", detail: "Pending" },
          { label: "Nullifier recorded", detail: "Verifying on Soroban" },
          { label: "Compliant transfer", detail: "US→MX · $1,000" },
        ],
      },
      metrics: {
        left: { value: "<5s", label: "Proof time" },
        right: { value: "256B", label: "Proof size" },
      },
    },
  },

  builders: {
    eyebrow: "CROSS-BORDER FLOWS",
    headlineRest: "Built for",
    headlineAccent: "cross-border stablecoin flows.",
    sub: "Wisp targets regulated corridors where issuers need compliant Stellar settlement.",
    featuredNote: "US→MX live on testnet",
    benefits: [
      {
        name: "Remittance corridors",
        stat: "US→MX",
        statLabel: "Live route",
        body: "Move stablecoins across high-friction remittance corridors with proof-backed compliance.",
        tags: ["Remittance", "Testnet"],
      },
      {
        name: "Corridor policy built in",
        stat: "8",
        statLabel: "Checks per proof",
        body: "Jurisdiction, sanctions, source, destination, asset, and amount are enforced in one proof.",
        tags: ["Travel rule", "Policy"],
      },
      {
        name: "Treasury payouts",
        stat: "B2B",
        statLabel: "Settlement",
        body: "Run compliant supplier and treasury transfers without attaching customer files to payments.",
        tags: ["Treasury", "Payouts"],
      },
      {
        name: "Issuer-ready corridors",
        stat: "1",
        statLabel: "Shared rail",
        body: "Multiple issuers can plug into the same corridor compliance model instead of rebuilding policy stacks.",
        tags: ["Anchors", "SDK"],
      },
      {
        name: "Regulated stablecoin movement",
        stat: "∞",
        statLabel: "Expansion paths",
        body: "Open new corridors without changing the proof model or exposing more data.",
        tags: ["Expansion", "Soroban"],
      },
    ],
  },

  sdk: {
    eyebrow: "PORTABLE SDK",
    headlineLead: "Portable issuer SDK.",
    headlineAccent: "Plug into any issuer.",
    sub: "Integrate once, prove in the browser, and switch issuers without rewriting the stack.",
    tabs: [
      { id: "pnpm", label: "pnpm", command: "pnpm add @wisp_/sdk" },
      { id: "npm", label: "npm", command: "npm install @wisp_/sdk" },
      { id: "yarn", label: "yarn", command: "yarn add @wisp_/sdk" },
      { id: "bun", label: "bun", command: "bun add @wisp_/sdk" },
      { id: "quickstart", label: "quickstart", command: "" },
    ],
    snippet: `import { WispClient } from "@wisp_/sdk";

const client = WispClient.fromEnv();
const proven = await client.prove({ package, browser: true });
await client.settleWithWallet(proven, pkg, wallet);`,
    stats: [
      { value: "<5s", label: "Browser proving" },
      { value: "256B", label: "Proof size" },
      { value: "8", label: "Checks per proof" },
    ],
  },

  complianceCard: {
    eyebrow: "TRANSFER LOGIC",
    headlineAccent: "Verify once.",
    headlineRest: "Prove every transfer.",
    sub: "One issuer credential. A fresh proof for every transfer.",
    card: {
      brand: "Wisp",
      network: "Stellar",
      holder: "verified-sender",
      pan: "4532 •••• •••• 0420",
      corridor: "US → MX",
      status: "COMPLIANT",
    },
    perks: [
      {
        label: "Verify once",
        detail: "Issuer signs your credential. Merkle root on-chain. No repeat uploads.",
      },
      {
        label: "Prove anywhere",
        detail: "Generate a fresh Groth16 proof for each compliant transfer.",
      },
      {
        label: "Audit forever",
        detail: "Nullifiers and ProofSettled events — replayable from any tx hash.",
      },
    ],
  },

  move: {
    closer: {
      eyebrow: "LIVE RAILS",
      headline: "Ready for live issuer rails.",
      sub: "Portable zk compliance infrastructure for cross-border Stellar stablecoins.",
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
      usdcFundingHint: "Fund this wallet with testnet USDC before submitting.",
      duplicateNullifier:
        "This nullifier was already settled on-chain. Fetch a fresh proof package and generate a new proof.",
      replayHint: "Replay rejected — generate a new proof with a fresh nullifier.",
      sourceCountry: "Source country",
      destCountry: "Destination country",
      corridor: "Corridor",
      asset: "USDC",
      complianceDetails: "Compliance",
      corridorId: "Corridor",
      nullifier: "Nullifier",
      transaction: "Transaction",
      connectWallet: "Connect Freighter",
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
} as const;
