# circuits/circom/lib

Off-circuit crypto lives in `@wisp_/js` (`packages/wisp-js`). This directory previously held `.mjs` shims re-exporting that package; they were removed during the TypeScript migration.

Import from `@wisp_/js` in fixture scripts and tests:

- `field`, `poseidon2`, `merkle`, `protocol`, `strkey`, `witness`
