import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildWitnessInput,
  computeCorridorConfigHash,
  CORRIDOR_ID,
  NULLIFIER_DOMAIN_TAG,
  PUBLIC_INPUT_FIELDS,
} from "../scripts/gen-fixture.mjs";
import { mod } from "../lib/field.mjs";
import { poseidon2Hash1, poseidon2Hash11 } from "../lib/poseidon2.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUTS = join(__dirname, "..", "inputs");

test("public input field order matches generated ABI", () => {
  const witness = buildWitnessInput({});
  for (const key of PUBLIC_INPUT_FIELDS) {
    assert.ok(key in witness, `missing public field ${key}`);
  }
  assert.equal(PUBLIC_INPUT_FIELDS.length, 17);
});

test("nullifier binds corridor_id per circuit", () => {
  const witness = buildWitnessInput({});
  const domain = poseidon2Hash1(mod(NULLIFIER_DOMAIN_TAG));
  const recomputed = poseidon2Hash11([
    domain,
    424242n,
    BigInt(witness.sender_lo),
    BigInt(witness.sender_hi),
    BigInt(witness.asset_lo),
    BigInt(witness.asset_hi),
    BigInt(witness.epoch),
    BigInt(witness.recipient_lo),
    BigInt(witness.recipient_hi),
    BigInt(witness.amount),
    CORRIDOR_ID,
  ]);
  assert.equal(witness.nullifier, recomputed.toString());
});

test("corridor_config_hash is canonical for registered corridor", () => {
  const witness = buildWitnessInput({});
  const expected = computeCorridorConfigHash({
    corridorId: CORRIDOR_ID,
    sourceJurisdictionRoot: BigInt(witness.source_jurisdiction_root),
    destAddressRoot: BigInt(witness.dest_address_root),
  });
  assert.equal(witness.corridor_config_hash, expected.toString());
});

test("valid fixture JSON is loadable", () => {
  const raw = JSON.parse(readFileSync(join(INPUTS, "valid.us-mx.json"), "utf8"));
  assert.equal(raw.corridor_id, "1");
  assert.ok(raw.nullifier);
});
