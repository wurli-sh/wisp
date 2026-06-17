# Brand — Amoeba

Zero-knowledge compliance rail for cross-border Stellar stablecoin transfers.

_Status: active_
_Last updated: 2026-06-18_

## Brand summary

Amoeba should read as regulated infrastructure, not consumer fintech. The product promise is simple: prove compliance without exposing customer data. The interface should feel strict, technical, and trustworthy, with a visible bias toward auditability over decoration.

## Positioning

- Category: `infra/data`
- Mood: `technical`, `serious`, `minimal`
- Product cues: cross-border payments, compliance evidence, privacy-preserving proofs, audit trail

## Palette

Current source of truth: `frontend/src/app.css`

### Core colors

| Token | Hex | Use |
|---|---|---|
| `--color-primary` | `#00008A` | Primary CTAs, key highlights |
| `--color-primary-bright` | `#4D4DFF` | Active states, shimmer, focus emphasis |
| `--color-primary-soft` | `#E8E8FF` | Soft panels, tags, low-emphasis fills |
| `--color-primary-dark` | `#000066` | CTA borders, darker accents |
| `--color-background` | `#FFFFFF` | Page background |
| `--color-foreground` | `#0A0A2E` | Primary text |
| `--color-card` | `#F7F7FF` | Card surfaces |
| `--color-border` | `#D4D4F0` | Default borders |
| `--color-border-strong` | `#B8B8E8` | Stronger separators |
| `--color-muted-foreground` | `#4A4A7A` | Secondary text |
| `--color-charcoal` | `#1A1A1A` | Console/code surfaces |
| `--color-success` | `#059669` | Positive protocol state |
| `--color-warning` | `#D97706` | Cautionary status |
| `--color-destructive` | `#DC2626` | Failure/error states |

### Palette intent

The palette is built around deep ledger blue on white. It should communicate institutional confidence, machine-verifiable rigor, and clean separation between sensitive data and public proof. Blue carries the trust layer; neutral whites and indigos keep the product from drifting into generic fintech green.

## Typography

- Sans: `Space Grotesk`
- Fallback stack: `system-ui, -apple-system, sans-serif`
- Current source of truth: `frontend/src/app.css`

### Type guidance

- Headlines should be short, compact, and slightly assertive.
- Body copy should stay plain and factual.
- Numbers, proofs, hashes, and transaction references should feel operational, not decorative.
- Rounded or overly friendly typography would weaken the compliance posture.

## Shape and layout

- Radius: `0`
- Edge style: hard corners, clean rules, framed sections
- Spacing feel: structured, deliberate, grid-driven
- Shadows: subtle inset and ledger-like framing, not soft floating cards

This system should feel like a compliance terminal translated into a modern product page.

## Motion

Motion should reinforce verification and progression, not delight for its own sake.

- Prefer linear reveals, shimmer passes, and state transitions tied to proof activity
- Keep animation restrained and directional
- Avoid bouncy easing, playful overshoot, and attention-seeking loops

## Voice and tone

Current source of truth: `frontend/src/content/copy.ts`

### Voice profile

The voice is direct, technical, and outcome-first. It should explain what is proven, what remains private, and what settles on-chain. It should never sound like marketing for a consumer payments app.

### Words to use

Use: prove, verify, settle, corridor, credential, issuer, nullifier, audit trail, compliant, private, on-chain, off-chain, replayable.

### Words to avoid

Avoid: frictionless, magical, seamless, revolutionary, unlock, supercharge, delightful, trust us.

### Example lines

- "Every transfer needs proof. Not paperwork."
- "Customer credentials stay off-chain."
- "Nullifiers and events leave an auditable trail without the documents."

## UI dos and don'ts

### Do

- Use the blue palette consistently for trust-bearing actions and proof states
- Keep sections high-contrast and easy to scan
- Make compliance evidence feel concrete with labels, metrics, and protocol nouns
- Use muted indigo text for secondary explanation instead of lowering clarity

### Don't

- Introduce soft consumer gradients or neon crypto styling
- Over-round controls or cards
- Hide critical protocol details behind vague copy
- Use bright success greens as the primary brand color

## Implementation notes

- Theme system: Tailwind v4 `@theme` variables in `frontend/src/app.css`
- App shell: Vite + React, not Next.js
- No separate dark theme is defined yet
- No brand gradients are defined yet

## Short directive for future UI work

If a design choice makes Amoeba feel more like a bank compliance rail and less like a retail crypto app, it is probably correct.
