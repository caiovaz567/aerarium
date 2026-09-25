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

/** Current month as the app computes it (São Paulo time). */
export function currentMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((part) => part.type === type)!.value
  return `${get('year')}-${get('month')}`
}
