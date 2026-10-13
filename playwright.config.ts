import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);
const port = process.env.PORT ?? "3000";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  reporter: isCI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "publico", testMatch: ["**/auth.spec.ts", "**/menu.spec.ts"], use: { ...devices["Desktop Chrome"] } },
    // Os projetos abaixo alteram a Pizzaria Demo: rodam depois do "publico", sem retry (estado já mudou).
    { name: "pedido", testMatch: ["**/pedido*.spec.ts"], dependencies: ["publico"], retries: 0, use: { ...devices["Desktop Chrome"] } },
    { name: "painel", testMatch: ["**/painel*.spec.ts"], dependencies: ["pedido"], retries: 0, use: { ...devices["Desktop Chrome"] } },
    { name: "admin", testMatch: ["**/admin.spec.ts"], dependencies: ["painel"], retries: 0, use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: isCI ? "npm run start" : "npm run dev",
    url: `http://localhost:${port}`,
    env: Object.fromEntries(
      Object.entries({ ...process.env, E2E_DISABLE_AUTH_RATE_LIMIT: "1" }).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    ),
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
