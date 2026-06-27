import assert from "node:assert/strict";
import test from "node:test";
import { HttpIssuerAdapter, issuerFetch, vkHashesMatch, } from "./index.js";
import { clampStartLedger, parseOldestLedgerFromError } from "./ledger-window.js";
function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}
test("HttpIssuerAdapter normalizes trailing slashes and sends canonical requests", { concurrency: false }, async () => {
    const original = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (input, init) => {
        calls.push({ url: String(input), init });
        return jsonResponse({ ok: true });
    };
    try {
        const client = new HttpIssuerAdapter("https://issuer.test///");
        await client.createProofPackage({
            challenge_id: "challenge",
            signed_message: "signature",
        });
        assert.equal(calls[0]?.url, "https://issuer.test/proof-packages");
        assert.equal(calls[0]?.init?.method, "POST");
        assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
            challenge_id: "challenge",
            signed_message: "signature",
        });
    }
    finally {
        globalThis.fetch = original;
    }
});
test("issuerFetch retries transient failures but not permanent client errors", { concurrency: false }, async () => {
    const original = globalThis.fetch;
    let attempts = 0;
    globalThis.fetch = async () => {
        attempts += 1;
        return new Response("", { status: attempts < 3 ? 503 : 200 });
    };
    try {
        assert.equal((await issuerFetch("https://issuer.test", undefined, { retries: 2 })).status, 200);
        assert.equal(attempts, 3);
        attempts = 0;
        globalThis.fetch = async () => {
            attempts += 1;
            return new Response("", { status: 400 });
        };
        assert.equal((await issuerFetch("https://issuer.test", undefined, { retries: 5 })).status, 400);
        assert.equal(attempts, 1);
    }
    finally {
        globalThis.fetch = original;
    }
});
test("issuerFetch validates retry configuration and preserves non-network errors", { concurrency: false }, async () => {
    await assert.rejects(() => issuerFetch("https://issuer.test", undefined, { retries: -1 }), /non-negative/);
    const original = globalThis.fetch;
    globalThis.fetch = async () => {
        throw new Error("application bug");
    };
    try {
        await assert.rejects(() => issuerFetch("https://issuer.test"), /application bug/);
    }
    finally {
        globalThis.fetch = original;
    }
});
test("adapter handles concurrent requests without cross-talk", { concurrency: false }, async () => {
    const original = globalThis.fetch;
    const urls = [];
    globalThis.fetch = async (input) => {
        urls.push(String(input));
        return jsonResponse([]);
    };
    try {
        const client = new HttpIssuerAdapter("https://issuer.test");
        await Promise.all(Array.from({ length: 100 }, () => client.listCorridors()));
        assert.equal(urls.length, 100);
        assert.equal(new Set(urls).size, 1);
    }
    finally {
        globalThis.fetch = original;
    }
});
test("ledger and VK helpers cover retention and formatting boundaries", () => {
    assert.equal(clampStartLedger(1, 200_000), 80_000);
    assert.equal(clampStartLedger(99, 50), 99);
    assert.equal(parseOldestLedgerFromError(new Error("valid range 123–456")), 123);
    assert.equal(parseOldestLedgerFromError("oldest ledger is 789"), 789);
    assert.equal(parseOldestLedgerFromError({
        code: -32600,
        message: "startLedger must be within the ledger range: 3183493 - 3304452",
    }), 3183493);
    assert.equal(parseOldestLedgerFromError("unrelated"), null);
    assert.equal(vkHashesMatch("0xAABB", "aabb"), true);
    assert.equal(vkHashesMatch("aa", "bb"), false);
});
test("empty issuer URL is rejected at construction", () => {
    assert.throws(() => new HttpIssuerAdapter("///"), /base URL is required/);
});
//# sourceMappingURL=client.test.js.map