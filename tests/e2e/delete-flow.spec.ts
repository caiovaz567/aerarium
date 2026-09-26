import { expect, test } from '@playwright/test'
import { spawnSync } from 'node:child_process'

// Deletes a real (fictitious) account on the development project, through the
// delete-account Edge Function. Runs in the "fluxo" project, never in parallel.
// The disposable account is created again by npm run e2e:user every time.
const EMAIL = 'aerarium.e2e.apagar@example.test'

test.beforeAll(() => {
  test.skip(!process.env.E2E_PASSWORD, 'Sem conta de teste.')
  const result = spawnSync(process.execPath, ['scripts/e2e-user.mjs'], {
    encoding: 'utf8',
    timeout: 90_000,
  })
  if (result.status !== 0)
    throw new Error(`npm run e2e:user falhou: ${result.stderr}`)
})

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(EMAIL)
  await page.getByLabel('Senha').fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

test('apagar minha conta: digita APAGAR, a conta some e não entra mais', async ({
  page,
}) => {
  await signIn(page)
  await expect(page).toHaveURL(/\/meses/)
  await page.goto('/config')
  await page
    .getByRole('button', { name: 'Apagar minha conta e meus dados' })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Apagar sua conta?' })
  await dialog.getByLabel('Digite APAGAR pra confirmar').fill('apagar')
  await dialog.getByRole('button', { name: 'Apagar tudo' }).click()

  await expect(
    page.getByText('Sua conta e seus dados foram apagados.'),
  ).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)

  await signIn(page)
  await expect(page.getByRole('alert')).toContainText(/e-mail ou senha/i)
  await expect(page).toHaveURL(/\/login$/)
})
