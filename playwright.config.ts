import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: process.env.APP_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  // Assumes `npm run dev` is already running with a seeded database
  // (`npm run db:seed`) — see README.md "Running the e2e tests".
});
