import { expect, test, type Locator, type Page } from '@playwright/test'
import { signedIn } from './session'

// Read only: every project, in parallel. Opens each Phase 8 screen and dialog.
signedIn()

const noSideScroll = async (page: Page, dialog?: Locator) => {
  const widths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  expect(widths.content).toBeLessThanOrEqual(widths.viewport)
  if (dialog)
    expect(
      await dialog.evaluate((node) => node.scrollWidth - node.clientWidth),
    ).toBe(0)
}

test('aba Assinaturas e o modal de assinatura', async ({ page }, testInfo) => {
  await page.goto('/assinaturas')
  await expect(page.getByText('Próxima cobrança')).toBeVisible()
  await noSideScroll(page)
  await page.screenshot({ path: testInfo.outputPath('assinaturas.png') })
  await page.getByRole('button', { name: /^dia 10 Streaming/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Editar assinatura' })
  await expect(dialog.getByLabel('Assinatura', { exact: true })).toHaveValue(
    'Streaming',
  )
  await noSideScroll(page, dialog)
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
})

test('modais de cartão e de parcelamento cabem na tela', async ({
  page,
}, testInfo) => {
  await page.goto('/cartoes?mes=2026-09')
  await page.getByRole('button', { name: 'Editar Nubank Teste' }).click()
  const card = page.getByRole('dialog', { name: 'Editar cartão' })
  await expect(card.getByRole('radio', { name: 'Nubank' })).toBeChecked()
  await noSideScroll(page, card)
  await page.screenshot({ path: testInfo.outputPath('cartao-editar.png') })
  await card.getByRole('button', { name: 'Cancelar' }).click()

  await page.getByRole('button', { name: /^Notebook/ }).click()
  const plan = page.getByRole('dialog', { name: 'Editar parcelamento' })
  await expect(plan.getByText('pela fatura')).toBeVisible()
  await noSideScroll(page, plan)
  await page.screenshot({ path: testInfo.outputPath('parcelamento.png') })
  await plan.getByRole('button', { name: 'Cancelar' }).click()
  await expect(plan).toBeHidden()
})

test('Excel baixa com o nome da data de hoje', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Download conferido no computador.')
  await page.goto('/meses/2026-09')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar tudo em Excel' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^Aerarium_\d{4}-\d{2}-\d{2}\.xlsx$/)
  await expect(page.locator('.toast')).toContainText('Excel baixado')
})
