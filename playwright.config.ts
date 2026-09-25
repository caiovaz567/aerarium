import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'

// E2E_EMAIL and E2E_PASSWORD come from .env.local (npm run e2e:user).
if (existsSync('.env.local')) process.loadEnvFile('.env.local')

/** Tests that change the e2e account's data; they run alone, after the rest. */
const FLOW = /flow\.spec\.ts$/
/** PWA checks run on the production build, where the service worker exists. */
const PWA = /pwa\.spec\.ts$/
const PREVIEW = 'http://127.0.0.1:4173'

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
      testIgnore: [FLOW, PWA],
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 390, height: 844 },
        colorScheme: 'light',
      },
    },
    {
      name: 'iphone-dark',
      dependencies: ['setup'],
      testIgnore: [FLOW, PWA],
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 390, height: 844 },
        colorScheme: 'dark',
      },
    },
    {
      name: 'desktop-light',
      dependencies: ['setup'],
      testIgnore: [FLOW, PWA],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        colorScheme: 'light',
      },
    },
    {
      name: 'desktop-dark',
      dependencies: ['setup'],
      testIgnore: [FLOW, PWA],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        colorScheme: 'dark',
      },
    },
    {
      // Changes data, so it runs alone after the layout checks.
      name: 'fluxo',
      testMatch: FLOW,
      dependencies: [
        'iphone-light',
        'iphone-dark',
        'desktop-light',
        'desktop-dark',
      ],
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 390, height: 844 },
        colorScheme: 'light',
      },
    },
    {
      name: 'pwa',
      testMatch: PWA,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: PREVIEW,
        serviceWorkers: 'allow',
      },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run build && npm run preview -- --port 4173 --strictPort',
      url: PREVIEW,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
})
