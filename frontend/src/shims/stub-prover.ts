export async function proveFromPackage(): Promise<never> {
  throw new Error("Node prove is unavailable in the browser. Use client.prove({ browser: true }).");
}
