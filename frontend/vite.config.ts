import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // `@wisp_/sdk/browser` has a node-free import graph, so no `node:*` shims or
    // prover stub are needed here. `buffer` remains because Stellar/snarkjs
    // expect a global Buffer in the browser (standard polyfill, see
    // `src/shims/buffer-global.ts`).
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      { find: "buffer", replacement: "buffer/" },
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
