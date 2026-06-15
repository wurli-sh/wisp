# frontend

Amoeba demo UI (`@amoeba/web`) — Vite 6 + React 19 + Tailwind 4.

**Routes:** `/` landing · `/demo` prove/settle console · `/compliance` (Proofs | Audit | Corridors tabs)

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev:frontend` | Dev server on :5173 |
| `pnpm build:frontend` | Production build |
| `./scripts/dev/demo-phase4.sh` | Copy circuit artifacts + build gate |

## Layout reference

- Shell/nav/footer: twiin (`somnia-agentation/twiin/apps/frontend`)
- Copy: `reference/frontend/src/content/copy.ts` → `src/content/copy.ts`
- Theme: blue `#00008A` / white, **zero border-radius**

## Env

See `frontend/.env.example`. Issuer proxied at `/issuer` → `localhost:3000`.

Circuit WASM/zkey served from `public/circuits/` (copied by `demo-phase4.sh`).
