import { test, type Page } from '@playwright/test'

/** Signed-in browser state saved by auth.setup.ts (outside Git). */
export const SESSION = '.artifacts/e2e/session.json'

/**
 * The app's "today" in these tests: 15/09/2026, the fixture's current month,
 * whatever the real date is (else a new month would start by itself).
 */
export const TODAY = new Date('2026-09-15T12:00:00-03:00')

/** Every page of a test sees TODAY as the date. */
export function fixedToday(page: Page) {
  return page.clock.setFixedTime(TODAY)
}

/** Reuse the saved session; skip when the test account is not configured. */
export function signedIn() {
  test.beforeEach(({ page }) => fixedToday(page))
  test.skip(
    !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
    'Sem conta de teste. Rode npm run e2e:user.',
  )
  test.use({ storageState: SESSION })
}
