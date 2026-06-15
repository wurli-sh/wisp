export function execFileSync(): never {
  throw new Error("child_process is not available in the browser");
}

export default { execFileSync };
