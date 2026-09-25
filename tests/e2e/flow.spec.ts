import { expect, test, type Page } from '@playwright/test'
import { e2eClient, resetFixture } from './fixture'
import { signedIn } from './session'

// Changes the e2e account's data and checks it survives a reload.
// Runs alone (project "fluxo"), and puts the fixture back at the end.
signedIn()
test.describe.configure({ mode: 'serial' })
test.afterAll(async () => resetFixture(await e2eClient()))

const spaced = (value: string | null) => value?.replace(/\s/g, ' ')
const heroValue = async (page: Page, label: string) =>
  spaced(
    await page
      .getByRole('region', { name: 'Resumo do mês' })
      .locator('dt', { hasText: label })
      .locator('+ dd')
      .textContent(),
  )
/** Waits until every change reached the database. */
async function saved(page: Page) {
  await page.waitForLoadState('networkidle')
  await expect(page.locator('.sync')).toHaveAttribute('data-state', 'ok')
}

test('marcar pago e desfazer exclusão ficam gravados', async ({ page }) => {
  await page.goto('/meses/2026-09')
  await page
    .getByRole('button', { name: 'Marcar como pago: Conta de luz' })
    .click()
  await expect(await heroValue(page, 'Falta pagar')).toBe('R$ 592,92')

  await page.getByRole('button', { name: 'Excluir Internet' }).click()
  await expect(page.getByText('Internet', { exact: true })).toBeHidden()
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(page.getByText('Internet', { exact: true })).toBeVisible()
  await saved(page)

  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Pago: Conta de luz' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Internet', { exact: true })).toBeVisible()
  expect(await heroValue(page, 'Falta pagar')).toBe('R$ 592,92')
})

test('"Sei o total" e a sobra do mês anterior ficam gravados', async ({
  page,
}) => {
  await page.goto('/meses/2026-09')
  await page.getByRole('button', { name: /^Nubank Teste/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Fatura Nubank Teste' })
  await dialog.getByRole('button', { name: 'Sei o total da fatura' }).click()
  await dialog.getByLabel('Total da fatura').fill('500')
  await dialog.getByRole('button', { name: 'Salvar' }).click()
  await page.getByRole('button', { name: 'Usar esse valor' }).click()
  await saved(page)

  await page.reload()
  await expect(
    page.getByRole('button', { name: /^Nubank Teste/ }),
  ).toContainText('R$ 500,00')
  // 5.000 + 2.990,10 in, and the invoice went from 442,92 to 500.
  expect(await heroValue(page, 'Entradas')).toBe('R$ 7.990,10')
  expect(await heroValue(page, 'Saídas')).toBe('R$ 930,25')
})

test('criar outubro, recarregar, excluir e desfazer', async ({ page }) => {
  await page.goto('/meses/2026-09')
  const available = spaced(await page.locator('.hero-num').textContent())!
  await page.getByRole('button', { name: 'Criar próximo mês' }).click()
  await page
    .getByRole('dialog', { name: 'Criar Outubro 2026' })
    .getByRole('button', { name: 'Criar mês' })
    .click()
  await expect(page).toHaveURL(/\/meses\/2026-10$/)
  await saved(page)

  await page.reload()
  await expect(page.getByText('Sobrou do mês passado')).toBeVisible()
  expect(
    spaced(
      await page
        .getByRole('button', { name: /^Sobrou do mês passado/ })
        .textContent(),
    ),
  ).toContain(available)
  await expect(page.getByText('estimada')).toHaveCount(2)

  await page.getByRole('button', { name: 'Outubro 2026. Escolher mês' }).click()
  const list = page.getByRole('dialog', { name: 'Seus meses' })
  await list.getByRole('button', { name: 'Excluir Outubro 2026' }).click()
  await list.getByRole('button', { name: 'Toca de novo pra confirmar' }).click()
  await expect(page).toHaveURL(/\/meses\/2026-09$/)
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(page).toHaveURL(/\/meses\/2026-10$/)
  await saved(page)
  await page.reload()
  await expect(page.getByText('Sobrou do mês passado')).toBeVisible()
})
