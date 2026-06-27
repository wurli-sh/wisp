import assert from "node:assert/strict";
import test from "node:test";
import { DemoIssuerClient } from "./index.js";

test("DemoIssuerClient encodes path/query values and admin authorization", { concurrency: false }, async () => {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({}), { status: 200 });
  };
  try {
    const client = new DemoIssuerClient("https://issuer.test/");
    await client.getMockKycStatus("G/unsafe wallet", {
      corridor_id: 0,
      recipient: "G recipient/+",
    });
    await client.addCorridorDestination(7, "GDEST", "secret token");
    await client.publishIssuerRoots("secret token", 0);

    assert.equal(
      calls[0]?.url,
      "https://issuer.test/v1/mock-kyc/status/G%2Funsafe%20wallet?corridor_id=0&recipient=G+recipient%2F%2B",
    );
    assert.equal((calls[1]?.init?.headers as Record<string, string>).Authorization, "Bearer secret token");
    assert.deepEqual(JSON.parse(String(calls[2]?.init?.body)), { corridor_id: 0 });
  } finally {
    globalThis.fetch = original;
  }
});

test("DemoIssuerClient exposes demo capabilities", () => {
  assert.deepEqual(new DemoIssuerClient("https://issuer.test").capabilities(), {
    proofPackages: true,
    corridors: true,
    wellKnown: true,
    kyc: true,
    admin: true,
  });
});
