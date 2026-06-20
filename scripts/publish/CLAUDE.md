# scripts/publish

npm publishing for the `@wisp_/*` JavaScript packages.

## Script

| Script | Purpose |
|--------|---------|
| `publish-packages.sh` | Build all publishable packages and publish to npm in dependency order |

```bash
# Dry run (no upload — inspect tarball contents)
./scripts/publish/publish-packages.sh --dry-run

# Real publish
./scripts/publish/publish-packages.sh
```

The script runs `pnpm build:js` first, then publishes each package with `pnpm publish --access public --no-git-checks`.

## Publishable packages (order)

Publish **must** follow this order — each layer depends on the previous:

| # | Package | Path |
|---|---------|------|
| 1 | `@wisp_/js` | `packages/wisp-js/` |
| 2 | `@wisp_/compliance` | `bindings/generated/compliance/` |
| 3 | `@wisp_/verifier` | `bindings/generated/verifier/` |
| 4 | `@wisp_/bindings` | `bindings/` |
| 5 | `@wisp_/sdk` | `sdk/` |
| 6 | `@wisp_/issuer-sdk` | `issuer-sdk/` |

**Not published:** `@wisp_/web` (`frontend/`) — demo app only. Root `wisp` package stays `private`.

## Prerequisites

### Node + pnpm

Use **Node 25** (see `.nvmrc`) and **pnpm 10.33.0** (matches CI). Node 20 + corepack pnpm 11.x can fail with `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`.

```bash
nvm use 25
# If nvm complains about ~/.npmrc prefix:
nvm use --delete-prefix v25.9.0 --silent
```

If `corepack` is available:

```bash
corepack enable
corepack prepare pnpm@10.33.0 --activate
```

### npm auth

**Do not** put tokens in repo files or `publish-packages.sh`.

**Local publish:**

```bash
npm login   # browser flow, or paste access token when prompted
```

Auth is stored in `~/.npmrc` on your machine.

**CI publish:** GitHub repo secret `NPM_TOKEN` → used by `.github/workflows/release.yml` as `NODE_AUTH_TOKEN`.

### npm org

Scoped packages publish under the **`@wisp_`** org on npm (the unscoped `wisp` org name was taken). Public packages are free. You must be an org member with publish rights.

### Two-factor authentication (publish 403)

If publish fails with:

```text
403 Forbidden - Two-factor authentication or granular access token with bypass 2fa enabled is required
```

Your account has 2FA (`auth-and-writes`). CLI publish needs **one** of:

**A. Granular token (recommended for scripts / CI)**

1. npm → Access Tokens → Granular Access Token  
2. Read and write on `@wisp_` packages  
3. Enable **bypass two-factor authentication** for automation  
4. `npm config set //registry.npmjs.org/:_authToken npm_xxxxxxxx`

**B. One-time password per publish**

```bash
export NPM_OTP=123456   # from authenticator app
./scripts/publish/publish-packages.sh
```

Or single package: `pnpm --filter @wisp_/js publish --access public --no-git-checks --otp=123456`

## CI release (alternative to local script)

Push a version tag to trigger automated publish:

```bash
git tag v0.1.1
git push origin v0.1.1
```

Workflow: `.github/workflows/release.yml` (runs on `v*` tags or **manual dispatch**). Requires `NPM_TOKEN` in GitHub Actions secrets (granular token with bypass 2FA).

Repo CI (`.github/workflows/ci.yml`) runs tests only — it does **not** deploy Vercel or Render.

## Version bumps

All publishable packages share the same version in their `package.json` (e.g. `0.1.0`). **npm rejects republishing the same version** — bump semver in every publishable `package.json` before a new release.

After bumping versions:

```bash
pnpm build:js
./scripts/publish/publish-packages.sh --dry-run
./scripts/publish/publish-packages.sh
```

## Verification

```bash
# After dry-run or publish
npm view @wisp_/sdk version

# Install smoke test (outside repo)
mkdir /tmp/wisp-npm-test && cd /tmp/wisp-npm-test
npm init -y
npm install @wisp_/sdk
node -e "import('@wisp_/sdk').then(m => console.log(Object.keys(m)))"
```

## Related

| Path | Notes |
|------|-------|
| `package.json` → `build:js` | Build chain before publish |
| `scripts/patch-bindings.sh` | After `soroban contract bindings ts`, re-patch and rebuild `@wisp_/compliance` / `@wisp_/verifier` |
| `bindings/CLAUDE.md` | ABI source of truth |
| `sdk/CLAUDE.md` | `@wisp_/sdk` layout |
| `packages/CLAUDE.md` | `@wisp_/js` |
