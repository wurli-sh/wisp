export function fileURLToPath(url: string | URL): string {
  const raw = typeof url === "string" ? url : url.pathname;
  return raw.replace(/^file:\/\//, "");
}

export default { fileURLToPath };
