import assert from "node:assert/strict";
import test from "node:test";
import {
  createAndSettleTransfer,
  createAndSettleTransferWithRetry,
  DuplicateNullifierError,
  type TransferClientLike,
} from "./index.js";

const SENDER = "11".repeat(32);
const RECIPIENT = "22".repeat(32);
const ISSUER = "33".repeat(32);
const ASSET = "44".repeat(32);

function makeIssuer(onCreate?: () => void) {
  return {
    async getCredential() {
      return {
        wallet: SENDER,
        jurisdiction: "US",
        jurisdiction_code: 840,
        credential_expiry: 2_000_000_000,
      };
    },
    async createActivationChallenge() {
      return { challenge_id: "activation", message: "activate", expires_at: 1 };
    },
    async activateCredential() {
      return { wallet: SENDER, credential_commitment: "1", activated_at: 1 };
    },
    async createProofPackageChallenge() {
      return { challenge_id: "proof", message: "prove", expires_at: 1 };
    },
    async createProofPackage() {
      onCreate?.();
      return {
        credential: {
          wallet: SENDER,
          jurisdiction: "US",
          jurisdiction_code: 840,
          credential_expiry: 2_000_000_000,
        },
        transfer: {
          asset: ASSET,
          sender: SENDER,
          recipient: RECIPIENT,
          amount: "1",
          corridor_id: 1,
          epoch: 1,
          timestamp: 86400,
        },
        roots: {},
        paths: {},
        witness_private: {
          transfer_nonce: "0",
          jurisdiction: "840",
          credential_expiry: "2000000000",
        },
        public_inputs: { issuer_lo: "1", issuer_hi: "2" },
      } as never;
    },
  };
}

function makeWallet() {
  return {
    publicKey: SENDER,
    async signTransaction(xdr: string) {
      return { signedTxXdr: xdr };
    },
    async signMessage() {
      return { signedMessage: new Uint8Array(64).fill(7) };
    },
  };
}

function makeClient(opts: { duplicate?: boolean } = {}): TransferClientLike {
  return {
    async validatePackage() {
      return { ok: true };
    },
    async prove() {
      return { nullifier: "123" };
    },
    async audit() {
      return { attested: Boolean(opts.duplicate) };
    },
    async approveSacForCompliance() {
      return { hash: "approve" };
    },
    async simulateSettle() {
      return { ok: true };
    },
    async settleWithWallet() {
      return { hash: "settle" };
    },
  };
}

test("createAndSettleTransfer returns staged results", async () => {
  const stages: string[] = [];
  const result = await createAndSettleTransfer({
    client: makeClient(),
    issuer: makeIssuer(),
    request: {
      sender_wallet: "sender",
      recipient_wallet: "recipient",
      amount: "1",
      corridor_id: 1,
    },
    validation: {
      issuerPublicKey: ISSUER,
      corridorId: 1,
      networkPassphrase: "test",
    },
    walletSigner: makeWallet(),
    senderAddress: SENDER,
    onStage(stage) {
      stages.push(stage);
    },
  });

  assert.equal(result.nullifier, "123");
  assert.deepEqual(stages, [
    "fetch",
    "validate",
    "prove",
    "duplicate-check",
    "approve",
    "simulate",
    "settle",
  ]);
});

test("createAndSettleTransfer throws DuplicateNullifierError when attested", async () => {
  await assert.rejects(
    () =>
      createAndSettleTransfer({
        client: makeClient({ duplicate: true }),
        issuer: makeIssuer(),
        request: {
          sender_wallet: "sender",
          recipient_wallet: "recipient",
          amount: "1",
          corridor_id: 1,
        },
        validation: {
          issuerPublicKey: ISSUER,
          corridorId: 1,
          networkPassphrase: "test",
        },
        walletSigner: makeWallet(),
        senderAddress: SENDER,
      }),
    DuplicateNullifierError,
  );
});

test("createAndSettleTransferWithRetry retries duplicate nullifier once", async () => {
  let duplicate = true;
  const result = await createAndSettleTransferWithRetry({
    client: {
      ...makeClient(),
      async audit() {
        const current = duplicate;
        duplicate = false;
        return { attested: current };
      },
    },
    issuer: makeIssuer(),
    request: {
      sender_wallet: "sender",
      recipient_wallet: "recipient",
      amount: "1",
      corridor_id: 1,
    },
    validation: {
      issuerPublicKey: ISSUER,
      corridorId: 1,
      networkPassphrase: "test",
    },
    walletSigner: makeWallet(),
    senderAddress: SENDER,
  });

  assert.equal(result.nullifier, "123");
});

test("retry never bypasses duplicate detection when issuer returns the same package", async () => {
  let approvals = 0;
  const client = {
    ...makeClient({ duplicate: true }),
    async approveSacForCompliance() {
      approvals += 1;
      return {};
    },
  };
  await assert.rejects(
    () =>
      createAndSettleTransferWithRetry({
        client,
        issuer: makeIssuer(),
        request: {
          sender_wallet: "sender",
          recipient_wallet: "recipient",
          amount: "1",
          corridor_id: 1,
        },
        validation: {
          issuerPublicKey: ISSUER,
          corridorId: 1,
          networkPassphrase: "test",
        },
        walletSigner: makeWallet(),
        senderAddress: SENDER,
      }),
    DuplicateNullifierError,
  );
  assert.equal(approvals, 0);
});

test("stage callbacks fire before the corresponding operation starts", async () => {
  const stages: string[] = [];
  const client = makeClient();
  await createAndSettleTransfer({
    client: {
      ...client,
      async validatePackage(...args) {
        assert.equal(stages.at(-1), "validate");
        return client.validatePackage(...args);
      },
    },
    issuer: makeIssuer(() => assert.equal(stages.at(-1), "fetch")),
    request: { sender_wallet: "sender", recipient_wallet: "recipient", amount: "1", corridor_id: 1 },
    validation: {
      issuerPublicKey: ISSUER,
      corridorId: 1,
      networkPassphrase: "test",
    },
    walletSigner: makeWallet(),
    senderAddress: SENDER,
    onStage(stage) {
      stages.push(stage);
    },
  });
});
