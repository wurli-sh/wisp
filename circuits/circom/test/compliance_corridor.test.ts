import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  computeCorridorConfigHash,
  computeNullifier,
  mod,
  toString,
} from "@wisp_/js";
import {
  buildWitnessInput,
  CORRIDOR_ID,
  PUBLIC_INPUT_FIELDS,
} from "../scripts/gen-fixture.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUTS = join(__dirname, "..", "inputs");

test("public input field order matches generated ABI", () => {
  const witness = buildWitnessInput({});
  for (const key of PUBLIC_INPUT_FIELDS) {
    assert.ok(key in witness, `missing public field ${key}`);
  }
  assert.equal(PUBLIC_INPUT_FIELDS.length, 19);
});

test("nullifier binds corridor_id per circuit", () => {
  const witness = buildWitnessInput({});
  const recomputed = computeNullifier({
    credentialSecret: 424242n,
    issuerLo: mod(witness.issuer_lo as string),
    issuerHi: mod(witness.issuer_hi as string),
    senderLo: mod(witness.sender_lo as string),
    senderHi: mod(witness.sender_hi as string),
    assetLo: mod(witness.asset_lo as string),
    assetHi: mod(witness.asset_hi as string),
    epoch: mod(witness.epoch as string),
    recipientLo: mod(witness.recipient_lo as string),
    recipientHi: mod(witness.recipient_hi as string),
    amount: mod(witness.amount as string),
    corridorId: CORRIDOR_ID,
    transferNonce: mod(witness.transfer_nonce as string),
  });
  assert.equal(witness.nullifier, toString(recomputed));
});

test("corridor_config_hash is canonical for registered corridor", () => {
  const witness = buildWitnessInput({});
  const expected = computeCorridorConfigHash({
    corridorId: CORRIDOR_ID,
    sourceJurisdictionRoot: mod(witness.source_jurisdiction_root as string),
    destAddressRoot: mod(witness.dest_address_root as string),
  });
  assert.equal(witness.corridor_config_hash, toString(expected));
});

test("valid fixture JSON is loadable", () => {
  const raw = JSON.parse(readFileSync(join(INPUTS, "valid.us-mx.json"), "utf8"));
  assert.equal(raw.corridor_id, "1");
  assert.ok(raw.nullifier);
});
