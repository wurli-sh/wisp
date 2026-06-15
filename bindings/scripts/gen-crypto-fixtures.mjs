import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  addressToLimbs,
  computeCorridorConfigHash,
  computeNullifier,
  mod,
  NULLIFIER_DOMAIN_TAG,
  poseidon2Hash1,
  poseidon2Hash2,
  merkleRootForLeafAtIndex,
  sparseSanctionsPath,
  toString,
} from "../../packages/amoeba-crypto/src/index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "..", "fixtures");
const demo = JSON.parse(
  fs.readFileSync(path.join(FIXTURES, "demo-transfer.json"), "utf8"),
);

const sender = Buffer.from(demo.sender_hex, "hex");
const recipient = Buffer.from(demo.recipient_hex, "hex");
const asset = Buffer.from(demo.asset_hex, "hex");
const credentialSecret = BigInt(demo.credential_secret);
const jurisdiction = BigInt(demo.jurisdiction);
const epoch = BigInt(demo.epoch);
const amount = BigInt(demo.amount);
const corridorId = BigInt(demo.corridor_id);

const senderLimbs = addressToLimbs(sender);
const recipientLimbs = addressToLimbs(recipient);
const assetLimbs = addressToLimbs(asset);

const senderLeaf = poseidon2Hash2(senderLimbs.lo, senderLimbs.hi);
const merkleRoot = merkleRootForLeafAtIndex(senderLeaf, 0);

const jurisdictionLeaf = poseidon2Hash1(jurisdiction);
const jurisdictionRoot = merkleRootForLeafAtIndex(jurisdictionLeaf, 0);
const sourceJurisdictionRoot = jurisdictionRoot;

const destLeaf = poseidon2Hash2(recipientLimbs.lo, recipientLimbs.hi);
const destAddressRoot = merkleRootForLeafAtIndex(destLeaf, 0);

const sanctions = sparseSanctionsPath(senderLimbs.lo, senderLimbs.hi);

const nullifier = computeNullifier({
  credentialSecret,
  senderLo: senderLimbs.lo,
  senderHi: senderLimbs.hi,
  assetLo: assetLimbs.lo,
  assetHi: assetLimbs.hi,
  epoch,
  recipientLo: recipientLimbs.lo,
  recipientHi: recipientLimbs.hi,
  amount,
  corridorId,
});

const corridorConfigHash = computeCorridorConfigHash({
  corridorId,
  sourceJurisdictionRoot,
  destAddressRoot,
});

const vectors = {
  address_limbs: {
    demo_sender: {
      hex: demo.sender_hex,
      lo: toString(senderLimbs.lo),
      hi: toString(senderLimbs.hi),
    },
    demo_recipient: {
      hex: demo.recipient_hex,
      lo: toString(recipientLimbs.lo),
      hi: toString(recipientLimbs.hi),
    },
    demo_asset: {
      hex: demo.asset_hex,
      lo: toString(assetLimbs.lo),
      hi: toString(assetLimbs.hi),
    },
  },
  poseidon2: {
    nullifier_domain: toString(poseidon2Hash1(mod(NULLIFIER_DOMAIN_TAG))),
    sender_leaf: toString(senderLeaf),
    jurisdiction_leaf: toString(jurisdictionLeaf),
    dest_leaf: toString(destLeaf),
  },
  merkle: {
    merkle_root: toString(merkleRoot),
    jurisdiction_root: toString(jurisdictionRoot),
    source_jurisdiction_root: toString(sourceJurisdictionRoot),
    dest_address_root: toString(destAddressRoot),
    sanctions_root: toString(sanctions.root),
  },
  nullifier: toString(nullifier),
  corridor_config_hash: toString(corridorConfigHash),
};

fs.writeFileSync(
  path.join(FIXTURES, "crypto.json"),
  JSON.stringify(vectors, null, 2) + "\n",
);
console.log("Wrote bindings/fixtures/crypto.json");
