declare module "snarkjs" {
  export const groth16: {
    fullProve: (
      input: Record<string, unknown>,
      wasmFile: string,
      zkeyFile: string,
    ) => Promise<{ proof: unknown; publicSignals: string[] }>;
  };
}
