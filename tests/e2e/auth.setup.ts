import { expect, test as setup } from '@playwright/test'
import { rmSync } from 'node:fs'
import { SESSION } from './session'

setup('entrar com a conta de teste', async ({ page }) => {
  rmSync(SESSION, { force: true })
  const email = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD
  setup.skip(!email || !password, 'Sem conta de teste. Rode npm run e2e:user.')
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email!)
  await page.getByLabel('Senha').fill(password!)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/meses\/\d{4}-\d{2}$/)
  await page.context().storageState({ path: SESSION })
})
