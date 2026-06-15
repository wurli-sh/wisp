import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  PUBLIC_INPUT_COUNT,
  PUBLIC_INPUT_FIELDS,
  PROTOCOL,
} from "@amoeba/bindings/publicInputs";
import protocol from "../protocol.json" with { type: "json" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("public input ABI has 17 fields", () => {
  assert.equal(PUBLIC_INPUT_COUNT, 17);
  assert.equal(PUBLIC_INPUT_FIELDS.length, 17);
});

test("protocol constants match protocol.json", () => {
  assert.equal(PROTOCOL.EPOCH_LEN_SECS, protocol.EPOCH_LEN_SECS);
  assert.equal(PROTOCOL.MERKLE_DEPTH, protocol.MERKLE_DEPTH);
  assert.equal(
    PROTOCOL.NULLIFIER_DOMAIN_TAG,
    BigInt(protocol.NULLIFIER_DOMAIN_TAG as string),
  );
  assert.equal(
    PROTOCOL.CORRIDOR_DOMAIN_TAG,
    BigInt(protocol.CORRIDOR_DOMAIN_TAG as string),
  );
});

test("valid fixture contains all public input field keys", () => {
  const valid = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "fixtures", "public-inputs.valid.json"),
      "utf8",
    ),
  ) as Record<string, string>;
  for (const field of PUBLIC_INPUT_FIELDS) {
    assert.ok(field in valid, `missing ${field}`);
  }
});
