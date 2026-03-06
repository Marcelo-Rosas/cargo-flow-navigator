import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

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
    baseURL: process.env.PW_BASE_URL || 'https://cargo-flow-navigator.vercel.app',
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
