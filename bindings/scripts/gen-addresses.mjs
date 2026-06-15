import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addressToLimbs, toString } from "../../packages/amoeba-crypto/src/index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "..", "fixtures");
const demo = JSON.parse(
  fs.readFileSync(path.join(FIXTURES, "demo-transfer.json"), "utf8"),
);

function decodeStrKey(strkey) {
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = strkey.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of cleaned) {
    const idx = ALPHABET.indexOf(char);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }
  return Buffer.from(bytes.slice(0, -2));
}

const gAddress = "GBBO4ZDDZ658HABSFYAFK2RFX5HSL6O74QK6LJ6CDT6K7HCM7A2SYEF";
const cContract = "CAUPSWAQLEK5UH63LSCTH4HELV6IIELGMRVHU4NTBEYQ7AOX2MHRTYUJ";

const gPayload = decodeStrKey(gAddress).subarray(1, 33);
const cPayload = decodeStrKey(cContract).subarray(1, 33);

const gLimbs = addressToLimbs(gPayload);
const cLimbs = addressToLimbs(cPayload);
const demoSender = addressToLimbs(Buffer.from(demo.sender_hex, "hex"));

const out = {
  demo_sender_hex: {
    hex: demo.sender_hex,
    lo: toString(demoSender.lo),
    hi: toString(demoSender.hi),
  },
  stellar_g_address: {
    strkey: gAddress,
    payload_hex: gPayload.toString("hex"),
    lo: toString(gLimbs.lo),
    hi: toString(gLimbs.hi),
  },
  stellar_c_contract: {
    strkey: cContract,
    payload_hex: cPayload.toString("hex"),
    lo: toString(cLimbs.lo),
    hi: toString(cLimbs.hi),
  },
};

fs.writeFileSync(
  path.join(FIXTURES, "addresses.json"),
  JSON.stringify(out, null, 2) + "\n",
);
console.log("Wrote bindings/fixtures/addresses.json");
