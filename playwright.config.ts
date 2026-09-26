import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 4173);
const basePath = process.env.BASE_PATH ?? '';

export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${port}${basePath}/`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node scripts/serve-out.mjs`,
    env: { PORT: String(port), BASE_PATH: basePath },
    url: `http://localhost:${port}${basePath}/`,
    reuseExistingServer: !process.env.CI,
  },
});
