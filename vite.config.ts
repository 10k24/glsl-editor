import { defineConfig } from "vite";
import path from "path";

const rawPort = process.env.PORT || 3000;
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

const basePath = process.env.BASE_PATH || "/";

export default defineConfig({
  base: basePath,
  resolve: {
    alias: {
      "@assets": path.resolve(import.meta.dirname, "public/assets"),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    // GitHub Pages serves the committed docs/ folder from main (same convention as 10k24.github.io)
    outDir: path.resolve(import.meta.dirname, "docs"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
