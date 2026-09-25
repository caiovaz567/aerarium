import { test } from '@playwright/test'

/** Signed-in browser state saved by auth.setup.ts (outside Git). */
export const SESSION = '.artifacts/e2e/session.json'

/** Reuse the saved session; skip when the test account is not configured. */
export function signedIn() {
  test.skip(
    !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
    'Sem conta de teste. Rode npm run e2e:user.',
  )
  test.use({ storageState: SESSION })
}
