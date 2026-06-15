export function existsSync(): boolean {
  return false;
}

export function readFileSync(): string {
  throw new Error("fs.readFileSync is not available in the browser");
}

export function mkdtempSync(): string {
  return "/tmp/amoeba-browser";
}

export function writeFileSync(): void {
  /* noop stub */
}

export default {
  existsSync,
  readFileSync,
  mkdtempSync,
  writeFileSync,
};
