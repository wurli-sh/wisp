# syntax=docker/dockerfile:1

FROM rust:1-bookworm AS builder
WORKDIR /app

ARG STELLAR_CLI_VERSION=25.2.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl pkg-config libssl-dev libdbus-1-dev libudev-dev \
  && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY backend ./backend
COPY bindings/generated/public_inputs.rs ./bindings/generated/public_inputs.rs

RUN cargo build --release -p issuer-service
RUN set -eux; \
  mkdir -p /tmp/stellar-cli; \
  curl -fsSL "https://github.com/stellar/stellar-cli/releases/download/v${STELLAR_CLI_VERSION}/stellar-cli-${STELLAR_CLI_VERSION}-x86_64-unknown-linux-gnu.tar.gz" \
    | tar -xz -C /tmp/stellar-cli; \
  find /tmp/stellar-cli -type f -name stellar -exec cp {} /usr/local/cargo/bin/stellar \; -quit; \
  chmod +x /usr/local/cargo/bin/stellar; \
  test -x /usr/local/cargo/bin/stellar; \
  stellar --version; \
  rm -rf /tmp/stellar-cli

FROM debian:bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates libssl3 libdbus-1-3 libudev1 postgresql-client \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/issuer-service /app/issuer-service
COPY --from=builder /usr/local/cargo/bin/stellar /usr/local/bin/stellar
COPY bindings/fixtures /app/bindings/fixtures
COPY backend/crates/issuer-service/migrations /app/migrations
COPY scripts/deploy/migrate-issuer-db.sh /app/scripts/deploy/migrate-issuer-db.sh
COPY backend/crates/issuer-service/docker-entrypoint.sh /app/docker-entrypoint.sh

RUN chmod +x /app/docker-entrypoint.sh /app/scripts/deploy/migrate-issuer-db.sh \
  && ln -sf /usr/local/bin/stellar /usr/bin/stellar \
  && stellar --version

ENV WISP_FIXTURES_DIR=/app/bindings/fixtures \
    WISP_FIXTURE_PROFILE=testnet \
    WISP_ENV=production \
    ISSUER_REQUIRE_DB=1 \
    KYC_MODE=sep10 \
    MIGRATIONS_DIR=/app/migrations \
    STELLAR_RPC_URL=https://soroban-testnet.stellar.org \
    NETWORK_PASSPHRASE="Test SDF Network ; September 2015" \
    HORIZON_URL=https://horizon-testnet.stellar.org

EXPOSE 10000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
