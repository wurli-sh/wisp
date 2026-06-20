# frontend

Amoeba demo UI (`@amoeba_/web`) — Vite 6 + React 19 + Tailwind 4.

**Routes:** `/` landing · `/demo` prove/settle/kyc console

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev:frontend` | Dev server on :5173 |
| `pnpm build:frontend` | Production build |
| `./scripts/dev/demo-phase4.sh` | Copy circuit artifacts + build gate |

## Component structure

| Path | Purpose |
|------|---------|
| `pages/HomePage.tsx` | Landing page (7 sections) |
| `pages/DemoPage.tsx` | 11-step prove → settle → audit console |
| `components/demo/DemoProgressSidebar.tsx` | Step progress indicator |
| `components/demo/DemoTransferPanel.tsx` | Transfer form + results display |
| `components/demo/DemoKycPanel.tsx` | KYC verification UI |
| `components/demo/KycOnboardingModal.tsx` | KYC onboarding modal flow |
| `components/home/` | Hero, Paradox, Engine, ComplianceCard, UseCases, Sdk, CorridorGlobe, DeploymentCTA |
| `components/layout/` | Navbar, MainLayout, Footer |
| `components/ui/` | Badge, Button, DropdownPanel, Tabs, TextShimmer |
| `components/spell/` | `code-highlight`, `highlighted-text`, `tilt-card` animated components |
| `hooks/useAmoebaClient.ts` | SDK client integration |
| `hooks/useDemoIssuerClient.ts` | Demo-specific issuer client hook |
| `hooks/useEngineFlow.ts` | Engine pipeline animation flow |
| `hooks/useWallet.ts` | Freighter wallet connection |
| `lib/kyc.ts` | KYC flow state machine and types |
| `lib/demoLog.ts` | Console-style step logging |
| `lib/animations.ts` | GSAP / framer-motion animation helpers |
| `lib/cn.ts` | Tailwind class merge utility |
| `content/copy.ts` | All UI text content (single source of truth) |
| `config/layout.ts` | Route and section registry |
| `config/env.ts` | Environment config from `.env` |
| `config/circle-testnet-usdc.json` | Circle USDC testnet asset config for compliance demo |

## Theme

- Primary: `#141812` ink with `#2F6FE3` brand-blue accents
- `border-radius: 0` everywhere
- Font: `Space Grotesk`, system-ui sans-serif stack

## Env

See `frontend/.env.example`. Issuer proxied at `/issuer` → `localhost:3000`.

Circuit WASM/zkey served from `public/circuits/` (copied by `demo-phase4.sh`).
