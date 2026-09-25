import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'

// E2E_EMAIL and E2E_PASSWORD come from .env.local (npm run e2e:user).
if (existsSync('.env.local')) process.loadEnvFile('.env.local')

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'iphone-light',
      dependencies: ['setup'],
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 390, height: 844 },
        colorScheme: 'light',
      },
    },
    {
      name: 'iphone-dark',
      dependencies: ['setup'],
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 390, height: 844 },
        colorScheme: 'dark',
      },
    },
    {
      name: 'desktop-light',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        colorScheme: 'light',
      },
    },
    {
      name: 'desktop-dark',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        colorScheme: 'dark',
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
})
