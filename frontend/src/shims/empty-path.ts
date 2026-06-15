export function join(...parts: string[]): string {
  return parts.filter(Boolean).join("/");
}

export function dirname(p: string): string {
  const idx = p.lastIndexOf("/");
  return idx >= 0 ? p.slice(0, idx) : ".";
}

export function resolve(...parts: string[]): string {
  return join(...parts);
}

export default { join, dirname, resolve };
