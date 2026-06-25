import assert from "node:assert/strict";
import test from "node:test";
import {
  createAndSettleTransfer,
  createAndSettleTransferWithRetry,
  DuplicateNullifierError,
  type TransferClientLike,
} from "./index.js";

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
    issuer: {
      async createDemoTransfer() {
        return { transfer: { corridor_id: 1 }, public_inputs: {}, paths: {}, roots: {}, witness_private: {} } as never;
      },
    },
    request: {
      sender_wallet: "sender",
      recipient_wallet: "recipient",
      amount: "1",
      corridor_id: 1,
    },
    validation: {
      issuerPublicKey: "GISSUER",
      corridorId: 1,
    },
    walletSigner: {
      publicKey: "GSENDER",
      async signTransaction(xdr) {
        return { signedTxXdr: xdr };
      },
    },
    senderAddress: "GSENDER",
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
        issuer: {
          async createDemoTransfer() {
            return { transfer: { corridor_id: 1 }, public_inputs: {}, paths: {}, roots: {}, witness_private: {} } as never;
          },
        },
        request: {
          sender_wallet: "sender",
          recipient_wallet: "recipient",
          amount: "1",
          corridor_id: 1,
        },
        validation: {
          issuerPublicKey: "GISSUER",
          corridorId: 1,
        },
        walletSigner: {
          publicKey: "GSENDER",
          async signTransaction(xdr) {
            return { signedTxXdr: xdr };
          },
        },
        senderAddress: "GSENDER",
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
    issuer: {
      async createDemoTransfer() {
        return { transfer: { corridor_id: 1 }, public_inputs: {}, paths: {}, roots: {}, witness_private: {} } as never;
      },
    },
    request: {
      sender_wallet: "sender",
      recipient_wallet: "recipient",
      amount: "1",
      corridor_id: 1,
    },
    validation: {
      issuerPublicKey: "GISSUER",
      corridorId: 1,
    },
    walletSigner: {
      publicKey: "GSENDER",
      async signTransaction(xdr) {
        return { signedTxXdr: xdr };
      },
    },
    senderAddress: "GSENDER",
  });

  assert.equal(result.nullifier, "123");
});
