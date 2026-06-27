import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../config.js";

export interface DemoFixture {
  issuer_strkey?: string;
  asset_strkey?: string;
  sender_strkey?: string;
  recipient_strkey?: string;
}

/**
 * Node-only demo fixture loader. Read from `bindings/fixtures` on disk. This
 * module statically imports `node:fs`/`node:path`, so it is loaded lazily via a
 * non-analyzable dynamic import from {@link import("./compliant-transfer.js")}
 * and never enters a browser bundle.
 */
export function readDemoFixtureFromDisk(profile: string): DemoFixture {
  const name =
    profile === "testnet" ? "demo-transfer-testnet.json" : "demo-transfer.json";
  const raw = fs.readFileSync(path.join(REPO_ROOT, "bindings/fixtures", name), "utf8");
  return JSON.parse(raw) as DemoFixture;
}
