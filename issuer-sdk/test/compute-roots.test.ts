import assert from "node:assert/strict";
import test from "node:test";
import {
  computeCredentialCommitment,
  mod,
  normalizeField,
  toString as fieldToDecimal,
} from "@wisp_/js";
import { computeIssuerRoots, defaultJurisdictionCode } from "../src/compute-roots.js";

/**
 * Oracle: `circuits/circom/inputs/valid.us-mx.json` — a single-member US→MX
 * corridor whose public roots were produced by the Rust issuer-service. If the
 * TS port drifts from the reference layout, these equalities break.
 */
const FIXTURE = {
  merkleRoot: "-1978552626214668895987576208302751657780942005605729873672084762082235732132",
  sanctionsRoot:
    "1804918163634406073089572474391902529558147701065997558174519078702534722897",
  jurisdictionRoot:
    "-6141161466441324228237305199748005521528484870923600926673039332912063315496",
  sourceJurisdictionRoot:
    "-6141161466441324228237305199748005521528484870923600926673039332912063315496",
  destAddressRoot:
    "-126483043362148633822662654735419908047767493022833160885710952801413362188",
  corridorConfigHash:
    "-10255187350904623116206589816315674601259062869335998647541227807144036647304",
  senderLo: "21528975894082904090066538856997790465",
  senderHi: "88962710306127702866241727433142015",
  recipientLo: "20095106327972375235668719608427373040",
  recipientHi: "21440013183776776390764256242667748879",
  credentialSecret: "424242",
  jurisdiction: "840",
  credentialExpiry: "2000000000",
};

/** Rebuild a 32-byte address hex from (lo, hi) limbs: hi = first 16, lo = last 16. */
function limbsToHex(loDecimal: string, hiDecimal: string): string {
  const hi = BigInt(hiDecimal).toString(16).padStart(32, "0");
  const lo = BigInt(loDecimal).toString(16).padStart(32, "0");
  return hi + lo;
}

function commitmentDecimal(): string {
  return fieldToDecimal(
    computeCredentialCommitment({
      issuerLo: mod(BigInt(FIXTURE.senderLo)),
      issuerHi: mod(BigInt(FIXTURE.senderHi)),
      senderLo: mod(BigInt(FIXTURE.senderLo)),
      senderHi: mod(BigInt(FIXTURE.senderHi)),
      credentialSecret: BigInt(FIXTURE.credentialSecret),
      jurisdiction: BigInt(FIXTURE.jurisdiction),
      credentialExpiry: BigInt(FIXTURE.credentialExpiry),
    }),
  );
}

test("computeIssuerRoots matches the Rust issuer-service oracle (US→MX)", () => {
  const roots = computeIssuerRoots({
    members: [
      {
        wallet: limbsToHex(FIXTURE.senderLo, FIXTURE.senderHi),
        credentialCommitment: commitmentDecimal(),
        jurisdictionCode: 840,
      },
    ],
    destinations: [limbsToHex(FIXTURE.recipientLo, FIXTURE.recipientHi)],
    corridor: { id: 1, sourceCountry: "US", enabled: true, travelRuleThreshold: 0 },
  });

  const expectEq = (label: keyof typeof FIXTURE, actual: string) =>
    assert.equal(BigInt(actual), normalizeField(FIXTURE[label]), `${label} mismatch`);

  expectEq("merkleRoot", roots.merkleRoot);
  expectEq("sanctionsRoot", roots.sanctionsRoot);
  expectEq("jurisdictionRoot", roots.jurisdictionRoot);
  expectEq("sourceJurisdictionRoot", roots.sourceJurisdictionRoot);
  expectEq("destAddressRoot", roots.destAddressRoot);
  expectEq("corridorConfigHash", roots.corridorConfigHash);
});

test("computeIssuerRoots is deterministic regardless of member ordering", () => {
  const members = [
    { wallet: "11".repeat(32), credentialCommitment: "12345", jurisdictionCode: 840 },
    { wallet: "22".repeat(32), credentialCommitment: "67890", jurisdictionCode: 356 },
  ];
  const corridor = { id: 1, sourceCountry: "US" };
  const a = computeIssuerRoots({ members, destinations: ["33".repeat(32)], corridor });
  const b = computeIssuerRoots({
    members: [...members].reverse(),
    destinations: ["33".repeat(32)],
    corridor,
  });
  assert.deepEqual(a, b);
});

test("defaultJurisdictionCode mirrors the reference mapping", () => {
  assert.equal(defaultJurisdictionCode("us"), 840);
  assert.equal(defaultJurisdictionCode(" IN "), 356);
  assert.equal(defaultJurisdictionCode("SG"), 702);
  assert.equal(defaultJurisdictionCode("GB"), 826);
  assert.equal(defaultJurisdictionCode("ZZ"), 0);
});
