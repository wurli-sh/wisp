# Brand — Wisp

Zero-knowledge compliance rail for cross-border Stellar stablecoin transfers.

_Status: active_
_Last updated: 2026-06-19_

## Brand summary

Wisp should read as regulated infrastructure, not consumer fintech. The product promise is simple: prove compliance without exposing customer data. The interface should feel strict, technical, and trustworthy, with a visible bias toward auditability over decoration. The new color system keeps the restraint, but adds a sharper proof-led accent so the product feels more current and memorable.

## Positioning

- Category: `infra/data`
- Mood: `technical`, `serious`, `minimal`
- Product cues: cross-border payments, compliance evidence, privacy-preserving proofs, audit trail

## Palette

Current source of truth: `frontend/src/app.css`

### Core colors

| Token | Hex | Use |
|---|---|---|
| `--color-primary` | `#141812` | Primary text, high-importance labels, dark anchors |
| `--color-brand-sky` | `#B7E7FF` | Punch accent for verified states, badges, and emphasis fills |
| `--color-primary-soft` | `#F4FBFF` | Soft proof panels, tags, low-emphasis highlights |
| `--color-primary-dark` | `#0C100B` | CTA backgrounds, heavy dividers, dark emphasis |
| `--color-background` | `#F6F7F1` | Page background |
| `--color-foreground` | `#181C15` | Primary text |
| `--color-card` | `#FBFCF7` | Card surfaces |
| `--color-border` | `#C8CEBB` | Default borders |
| `--color-border-strong` | `#A7AE98` | Stronger separators |
| `--color-muted-foreground` | `#5A6251` | Secondary text |
| `--color-charcoal` | `#161914` | Console/code surfaces |
| `--color-success` | `#0F8A6A` | Positive protocol state |
| `--color-warning` | `#B66E1A` | Cautionary status |
| `--color-destructive` | `#C63B33` | Failure/error states |

### Palette intent

The palette is built around near-black ink on pale stone, with a lighter sky-blue accent used narrowly for proof and active states. Ink carries the structural weight; the accent marks what is verified, active, or worth immediate attention. The result should feel like compliance infrastructure with better signal density, not a consumer crypto rebrand.

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

- Use sky blue sparingly for trust-bearing actions and proof states
- Keep sections high-contrast and easy to scan
- Make compliance evidence feel concrete with labels, metrics, and protocol nouns
- Use muted olive-gray text for secondary explanation instead of lowering clarity

### Don't

- Introduce soft consumer gradients or flood the UI with blue
- Over-round controls or cards
- Hide critical protocol details behind vague copy
- Let the accent overwhelm ink as the structural color

## Implementation notes

- Theme system: Tailwind v4 `@theme` variables in `frontend/src/app.css`
- App shell: Vite + React, not Next.js
- No separate dark theme is defined yet
- No brand gradients are defined yet

## Short directive for future UI work

If a design choice makes Wisp feel more like an operational compliance rail and less like a retail crypto app, it is probably correct.
