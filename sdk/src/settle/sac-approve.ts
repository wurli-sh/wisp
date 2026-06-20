import {
  Address,
  Contract,
  Keypair,
  rpc,
  TransactionBuilder,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import type { WispConfig } from "../config.js";
import type { WalletSigner } from "./compliant-transfer.js";

export interface SacApproveResult {
  hash: string;
}

const SAC_ALLOWANCE_TTL_LEDGERS = 100_000;

async function allowanceExpirationLedger(server: rpc.Server): Promise<number> {
  const latest = await server.getLatestLedger();
  return Math.min(latest.sequence + SAC_ALLOWANCE_TTL_LEDGERS, 0xffff_ffff);
}

async function waitForSentTransaction(
  server: rpc.Server,
  hash: string,
  timeoutMs = 60_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const tx = await server.getTransaction(hash);
    if (tx.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return;
    }
    if (tx.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`approve transaction failed: ${hash}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`approve transaction not confirmed within timeout: ${hash}`);
}

export async function approveSacAllowance(
  cfg: WispConfig,
  wallet: WalletSigner,
  assetContractId: string,
  amount: bigint,
): Promise<SacApproveResult> {
  if (!cfg.complianceId) {
    throw new Error("COMPLIANCE_CONTRACT_ID not set");
  }

  const server = new rpc.Server(cfg.rpcUrl);
  const source = await server.getAccount(wallet.publicKey);
  const expirationLedger = await allowanceExpirationLedger(server);
  const contract = new Contract(assetContractId);
  const operation = contract.call(
    "approve",
    new Address(wallet.publicKey).toScVal(),
    new Address(cfg.complianceId).toScVal(),
    nativeToScVal(amount, { type: "i128" }),
    nativeToScVal(expirationLedger, { type: "u32" }),
  );

  let tx = new TransactionBuilder(source, {
    fee: "100000",
    networkPassphrase: cfg.networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  tx = await server.prepareTransaction(tx);
  const signed = await wallet.signTransaction(tx.toXDR());
  const signedTx = TransactionBuilder.fromXDR(
    signed.signedTxXdr,
    cfg.networkPassphrase,
  );
  const sent = await server.sendTransaction(signedTx);
  const hash = sent.hash;
  if (!hash) {
    throw new Error("approve transaction missing hash");
  }
  if (sent.status === "ERROR") {
    throw new Error(
      sent.errorResult
        ? `approve send failed: ${JSON.stringify(sent.errorResult)}`
        : "approve send failed",
    );
  }
  await waitForSentTransaction(server, hash);
  return { hash };
}

export async function approveSacAllowanceWithKeypair(
  cfg: WispConfig,
  secret: string,
  assetContractId: string,
  amount: bigint,
): Promise<SacApproveResult> {
  const kp = Keypair.fromSecret(secret);
  const wallet: WalletSigner = {
    publicKey: kp.publicKey(),
    signTransaction: async (xdr: string) => {
      const tx = TransactionBuilder.fromXDR(xdr, cfg.networkPassphrase);
      tx.sign(kp);
      return { signedTxXdr: tx.toXDR() };
    },
  };
  return approveSacAllowance(cfg, wallet, assetContractId, amount);
}
