import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PUBLIC_INPUT_FIELDS,
  rebuildExpectedPublicInputs,
  publicSignalsMatch,
} from "./publicInputs.js";
import { normalizeField } from "./field.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..", "..");
const FIXTURES = path.join(ROOT, "bindings", "fixtures");

const golden = JSON.parse(
  fs.readFileSync(path.join(FIXTURES, "public-inputs.valid.json"), "utf8"),
) as Record<string, string>;
const demoTransfer = JSON.parse(
  fs.readFileSync(path.join(FIXTURES, "demo-transfer.json"), "utf8"),
) as {
  asset_hex: string;
  sender_hex: string;
  recipient_hex: string;
  amount: string;
  corridor_id: number;
  epoch: string;
};

const rebuilt = rebuildExpectedPublicInputs({
  merkleRoot: golden.merkle_root!,
  nullifier: golden.nullifier!,
  asset: demoTransfer.asset_hex,
  sender: demoTransfer.sender_hex,
  recipient: demoTransfer.recipient_hex,
  amount: golden.amount!,
  sanctionsRoot: golden.sanctions_root!,
  jurisdictionRoot: golden.jurisdiction_root!,
  epoch: golden.epoch!,
  corridorId: Number(golden.corridor_id),
  corridorConfigHash: golden.corridor_config_hash!,
  sourceJurisdictionRoot: golden.source_jurisdiction_root!,
  destAddressRoot: golden.dest_address_root!,
});

for (const [index, name] of PUBLIC_INPUT_FIELDS.entries()) {
  assert.equal(
    rebuilt[index]!.toString(),
    normalizeField(golden[name]!).toString(),
    `${name} mismatch`,
  );
}

const goldenVector = PUBLIC_INPUT_FIELDS.map((name) => normalizeField(golden[name]!));
assert.ok(publicSignalsMatch(rebuilt, goldenVector));
console.log("rebuildExpectedPublicInputs matches public-inputs.valid.json");
