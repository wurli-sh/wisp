import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const shim = (name: string) => path.resolve(__dirname, `./src/shims/${name}.ts`);
const sdkProver = path.resolve(__dirname, "../sdk/dist/prove/prover.js");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      { find: "buffer", replacement: "buffer/" },
      { find: "fs", replacement: shim("empty-fs") },
      { find: "node:fs", replacement: shim("empty-fs") },
      { find: "path", replacement: shim("empty-path") },
      { find: "node:path", replacement: shim("empty-path") },
      { find: "node:child_process", replacement: shim("empty-child-process") },
      { find: "node:os", replacement: shim("empty-os") },
      { find: "node:url", replacement: shim("empty-url") },
      { find: sdkProver, replacement: shim("stub-prover") },
    ],
  },
  define: {
    global: "globalThis",
    "process.env": {},
  },
  optimizeDeps: {
    include: ["buffer", "snarkjs"],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/issuer": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/issuer/, ""),
      },
    },
  },
});
