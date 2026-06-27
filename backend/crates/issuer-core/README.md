# issuer-core

Internal Rust business-logic library used by the reference `issuer-service`.

This crate provides repository ports, in-memory implementations, issuer planning, root
computation, and canonical proof-package construction. It is linked into a Rust application at
compile time; it is not a server, sidecar, CLI, or public package.

External issuer operators should use:

- `@wisp_/issuer-sdk` for on-chain registration, corridor management, root publication, and
  conformance testing.
- The reference Rust `issuer-service`, or their own conforming HTTP service, for wallet-facing
  credential activation and proof-package issuance.

The crate is currently workspace-only (`publish = false`). A custom Rust issuer can depend on it
by repository path, but its API is not covered by the public SDK compatibility promise.
