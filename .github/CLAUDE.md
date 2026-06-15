# .github

CI/CD workflows for the Amoeba project.

## Workflows

| File | Trigger | Steps |
|------|---------|-------|
| `workflows/ci.yml` | PR + push to main | pnpm + Rust setup, lint (fmt, clippy), audit (pnpm, cargo), contract tests, circuit fixture validation, Node circuit tests, snarkjs verify, ceremony verify, stellar build |
