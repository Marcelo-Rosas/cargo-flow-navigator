import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.e2e', override: true });
import { defineConfig, devices } from '@playwright/test';

/**
 * baseURL: PW_BASE_URL (env) ou produção por padrão.
 * Para validar build local: PW_BASE_URL=http://localhost:4173 (servir antes com npm run preview:static).
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.PW_BASE_URL || 'https://app.vectracargo.com.br',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    { name: 'setup', testDir: './e2e', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium-mocks',
      testDir: './tests/e2e',
      testIgnore: ['**/*.seeded.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-auth',
      testDir: './tests/e2e',
      dependencies: ['setup'],
      testMatch: ['**/*.seeded.spec.ts'],
      use: { ...devices['Desktop Chrome'], storageState: '.auth/user.json' },
    },
    {
      name: 'auth',
      testDir: './e2e',
      use: { ...devices['Desktop Chrome'] },
      testMatch: [/auth\.spec\.ts/],
    },
  ],
});
