# circuits/circom/lib

Off-circuit crypto lives in `@amoeba_/js` (`packages/amoeba-js`). This directory previously held `.mjs` shims re-exporting that package; they were removed during the TypeScript migration.

Import from `@amoeba_/js` in fixture scripts and tests:

- `field`, `poseidon2`, `merkle`, `protocol`, `strkey`, `witness`
