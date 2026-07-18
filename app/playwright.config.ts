import { defineConfig, devices } from "@playwright/test";

// eslint-disable-next-line import/no-default-export
export default defineConfig({
  expect: { timeout: 20_000 },
  fullyParallel: false,
  globalSetup: "./tests/global-setup.ts",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  reporter: "list",
  testDir: "./tests",
  timeout: 180_000,
  use: { baseURL: "http://localhost:5177" },
  webServer: {
    command: "pnpm dev --port 5177",
    env: { VITE_MAINNET_RPC_URL: "http://127.0.0.1:8547/1" },
    reuseExistingServer: false,
    timeout: 120_000,
    url: "http://localhost:5177",
  },
  workers: 1,
});
