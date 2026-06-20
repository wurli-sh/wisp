import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  addressToLimbs,
  computeCorridorConfigHash,
  fieldToJson,
} from "@wisp_/js";
import {
  buildWitnessInput as buildWitnessCore,
  demoFromFixture,
} from "@wisp_/js/witness";
import { PUBLIC_INPUT_FIELDS, PROTOCOL } from "@wisp_/bindings/publicInputs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUTS_DIR = path.join(__dirname, "..", "inputs");
const FIXTURES_DIR = path.join(__dirname, "..", "..", "..", "bindings", "fixtures");

export const EPOCH_LEN_SECS = PROTOCOL.EPOCH_LEN_SECS;
export const CORRIDOR_ID = PROTOCOL.CORRIDOR_ID;
export const NULLIFIER_DOMAIN_TAG_EXPORT = PROTOCOL.NULLIFIER_DOMAIN_TAG;
export const CORRIDOR_DOMAIN_TAG = PROTOCOL.CORRIDOR_DOMAIN_TAG;

const profile = process.env.WISP_FIXTURE_PROFILE ?? "local";
const fixtureName =
  profile === "testnet" ? "demo-transfer-testnet.json" : "demo-transfer.json";

const demoTransfer = JSON.parse(
  fs.readFileSync(path.join(FIXTURES_DIR, fixtureName), "utf8"),
);

export const DEMO = demoFromFixture(demoTransfer);

export { addressToLimbs, computeCorridorConfigHash, PUBLIC_INPUT_FIELDS };

export function buildWitnessInputFromDemo(overrides = {}) {
  return buildWitnessCore(DEMO, overrides, PROTOCOL);
}

/** @deprecated use buildWitnessInputFromDemo */
export const buildWitnessInput = buildWitnessInputFromDemo;

export function writeFixture(name: string, overrides = {}) {
  const witness = buildWitnessInputFromDemo(overrides);
  const outPath = path.join(INPUTS_DIR, `${name}.json`);
  fs.mkdirSync(INPUTS_DIR, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(witness, null, 2) + "\n");
  return outPath;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const validName = profile === "testnet" ? "valid.testnet" : "valid.us-mx";
  const fixtures: Record<string, Record<string, unknown>> = {
    [validName]: {},
    "invalid.expired": { credential_expiry: 1n },
    "invalid.sanctioned": {
      sanctions_leaf_value: 1n,
    },
  };

  const writeTampered = (name: string, mutate: (w: Record<string, unknown>) => void) => {
    const w = buildWitnessInputFromDemo({}) as Record<string, unknown>;
    mutate(w);
    fs.mkdirSync(INPUTS_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(INPUTS_DIR, `${name}.json`),
      JSON.stringify(w, null, 2) + "\n",
    );
    console.log("wrote", name);
  };

  writeTampered("invalid.amount", (w) => {
    w.amount = "99999999";
  });
  writeTampered("invalid.recipient", (w) => {
    const recipientLimbs = addressToLimbs(Buffer.from("ff".repeat(32), "hex"));
    w.recipient_lo = fieldToJson(recipientLimbs.lo);
    w.recipient_hi = fieldToJson(recipientLimbs.hi);
  });
  writeTampered("invalid.corridor", (w) => {
    w.corridor_id = fieldToJson(99n);
  });

  for (const [name, overrides] of Object.entries(fixtures)) {
    if (name === "invalid.sanctioned") {
      const w = buildWitnessInputFromDemo({}) as Record<string, unknown>;
      w.sanctions_leaf_value = "1";
      fs.mkdirSync(INPUTS_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(INPUTS_DIR, `${name}.json`),
        JSON.stringify(w, null, 2) + "\n",
      );
      console.log("wrote", name);
      continue;
    }
    const p = writeFixture(name, overrides);
    console.log("wrote", p);
  }
}
