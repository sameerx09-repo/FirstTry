import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 12000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    ...(process.env.PLAYWRIGHT_CHANNEL === "chromium"
      ? {}
      : { channel: "msedge" }),
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1050 } } },
  ],
  webServer: [
    {
      command: "pnpm --filter @firsttry/api start",
      url: "http://127.0.0.1:3001/api/v1/health",
      reuseExistingServer: true,
      timeout: 60000,
    },
    {
      command: "pnpm --filter @firsttry/web dev",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: true,
      timeout: 60000,
    },
  ],
});
