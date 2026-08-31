import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  testMatch: "*.e2e.ts",
  use: {
    baseURL: "http://localhost:3999",
    headless: true,
  },
  webServer: {
    command: "PORT=3999 bun run dev",
    url: "http://localhost:3999",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
