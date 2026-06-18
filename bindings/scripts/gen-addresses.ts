import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addressToLimbs, toString } from "@amoeba_/js";
import { strKeyToPayload } from "@amoeba_/js/strkey";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "..", "fixtures");
const demo = JSON.parse(
  fs.readFileSync(path.join(FIXTURES, "demo-transfer.json"), "utf8"),
) as { sender_hex: string };

const gAddress = "GBBO4ZDDZ658HABSFYAFK2RFX5HSL6O74QK6LJ6CDT6K7HCM7A2SYEF";
const cContract = "CAUPSWAQLEK5UH63LSCTH4HELV6IIELGMRVHU4NTBEYQ7AOX2MHRTYUJ";

const gPayload = strKeyToPayload(gAddress);
const cPayload = strKeyToPayload(cContract);

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
