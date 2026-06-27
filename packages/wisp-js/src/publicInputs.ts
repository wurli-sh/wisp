import { normalizeField } from "./field.js";
import { addressToLimbs } from "./protocol.js";
import { strKeyToPayload } from "./strkey.js";
import { EPOCH_LEN_SECS } from "./witness.js";

export const PUBLIC_INPUT_FIELDS = [
  "merkle_root",
  "nullifier",
  "asset_lo",
  "asset_hi",
  "sender_lo",
  "sender_hi",
  "epoch",
  "recipient_lo",
  "recipient_hi",
  "amount",
  "sanctions_root",
  "jurisdiction_root",
  "timestamp",
  "corridor_id",
  "corridor_config_hash",
  "source_jurisdiction_root",
  "dest_address_root",
] as const;

export const PUBLIC_INPUT_COUNT = PUBLIC_INPUT_FIELDS.length;

export type PublicInputField = (typeof PUBLIC_INPUT_FIELDS)[number];

export interface RebuildPublicInputsParams {
  merkleRoot: string;
  nullifier: string;
  asset: string;
  sender: string;
  recipient: string;
  amount: bigint | string | number;
  sanctionsRoot: string;
  jurisdictionRoot: string;
  epoch: bigint | string | number;
  corridorId: number;
  corridorConfigHash: string;
  sourceJurisdictionRoot: string;
  destAddressRoot: string;
}

function fieldFromDecimal(decimal: string): bigint {
  return normalizeField(decimal);
}

function addressPayload(address: string): Buffer {
  const trimmed = address.trim();
  if (/^[GC][A-Z2-7]{55}$/i.test(trimmed)) {
    return strKeyToPayload(trimmed);
  }
  const hex = trimmed.replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("address must be a valid Stellar G/C StrKey or exactly 32-byte hex");
  }
  return Buffer.from(hex, "hex");
}

function limbsFromAddress(address: string): { lo: bigint; hi: bigint } {
  const { lo, hi } = addressToLimbs(addressPayload(address));
  return { lo: normalizeField(String(lo)), hi: normalizeField(String(hi)) };
}

/** Mirror compliance `rebuild_expected_public_inputs` (17 fields, contract order). */
export function rebuildExpectedPublicInputs(
  params: RebuildPublicInputsParams,
): bigint[] {
  const epoch = BigInt(params.epoch);
  const amount = BigInt(params.amount);
  if (amount <= 0n) {
    throw new Error("amount must be greater than zero");
  }
  const timestamp = epoch * BigInt(EPOCH_LEN_SECS);
  const { lo: assetLo, hi: assetHi } = limbsFromAddress(params.asset);
  const { lo: senderLo, hi: senderHi } = limbsFromAddress(params.sender);
  const { lo: recipientLo, hi: recipientHi } = limbsFromAddress(params.recipient);

  return [
    fieldFromDecimal(params.merkleRoot),
    fieldFromDecimal(params.nullifier),
    assetLo,
    assetHi,
    senderLo,
    senderHi,
    epoch,
    recipientLo,
    recipientHi,
    amount,
    fieldFromDecimal(params.sanctionsRoot),
    fieldFromDecimal(params.jurisdictionRoot),
    timestamp,
    BigInt(params.corridorId),
    fieldFromDecimal(params.corridorConfigHash),
    fieldFromDecimal(params.sourceJurisdictionRoot),
    fieldFromDecimal(params.destAddressRoot),
  ];
}

export function rebuildExpectedPublicInputsFromRoots(
  roots: {
    merkle_root: string;
    sanctions_root: string;
    jurisdiction_root: string;
    corridor_config_hash: string;
    source_jurisdiction_root: string;
    dest_address_root: string;
  },
  transfer: {
    asset: string;
    sender: string;
    recipient: string;
    amount: string;
    corridor_id: number;
    epoch: number | string;
  },
  nullifier: string,
): bigint[] {
  return rebuildExpectedPublicInputs({
    merkleRoot: roots.merkle_root,
    nullifier,
    asset: transfer.asset,
    sender: transfer.sender,
    recipient: transfer.recipient,
    amount: transfer.amount,
    sanctionsRoot: roots.sanctions_root,
    jurisdictionRoot: roots.jurisdiction_root,
    epoch: transfer.epoch,
    corridorId: transfer.corridor_id,
    corridorConfigHash: roots.corridor_config_hash,
    sourceJurisdictionRoot: roots.source_jurisdiction_root,
    destAddressRoot: roots.dest_address_root,
  });
}

export function publicInputsVectorToRecord(values: bigint[]): Record<PublicInputField, string> {
  if (values.length !== PUBLIC_INPUT_COUNT) {
    throw new Error(`expected ${PUBLIC_INPUT_COUNT} public inputs, got ${values.length}`);
  }
  const record = {} as Record<PublicInputField, string>;
  PUBLIC_INPUT_FIELDS.forEach((name, index) => {
    record[name] = values[index]!.toString();
  });
  return record;
}

export function publicSignalsMatch(a: bigint[], b: bigint[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}
