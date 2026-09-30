import { expect, test, type Locator, type Page } from '@playwright/test'
import { LONG_CARD } from './fixture'
import { signedIn } from './session'

// Read only: runs in every project, in parallel. Data: tests/e2e/fixture.ts.
signedIn()

const noSideScroll = async (page: Page) => {
  const widths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  expect(widths.content).toBeLessThanOrEqual(widths.viewport)
}
const spaced = (value: string | null) => value?.replace(/\s/g, ' ')
const box = async (locator: Locator) => (await locator.boundingBox())!

test('setembro vem do banco com os números certos', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/meses/2026-09')
  const hero = page.getByRole('region', { name: 'Resumo do mês' })
  await expect(hero).toContainText('Disponível em Setembro')
  expect(spaced(await hero.locator('.hero-num').textContent())).toBe(
    'R$ 4.226,83',
  )
  expect(spaced(await hero.locator('dd').allTextContents().then(String))).toBe(
    'R$ 5.100,00,R$ 873,17,R$ 773,27',
  )
  await expect(page.getByText('1 de 5 pagas')).toBeVisible()
  await expect(page.getByText('Agosto fechou com')).toBeVisible()
  await noSideScroll(page)
  await page.screenshot({
    path: testInfo.outputPath('setembro.png'),
    fullPage: true,
  })
  expect(errors).toEqual([])
})

test('nome de cartão longo e composição quebram sem "…"', async ({ page }) => {
  await page.goto('/meses/2026-09')
  const name = page.locator('.card-name', { hasText: LONG_CARD })
  await expect(name).toBeVisible()
  const style = await name.evaluate((node) => ({
    overflow: getComputedStyle(node).textOverflow,
    clipped: node.scrollWidth > node.clientWidth,
  }))
  expect(style).toEqual({ overflow: 'clip', clipped: false })
  // Each composition item stays on one line; wrapping happens between items.
  for (const part of await page.locator('.card-sub .part').all()) {
    const lines = await part.evaluate((node) => node.getClientRects().length)
    expect(lines).toBe(1)
  }
})

test('trocar de mês não mexe na barra nem no resumo', async ({ page }) => {
  await page.goto('/meses/2026-09')
  // The arrows stay put, whatever the month's name.
  const bar = page.locator('[aria-label="Mês anterior"]')
  const hero = page.getByRole('region', { name: 'Resumo do mês' })
  const before = [await box(bar), await box(hero)]
  await page.getByRole('link', { name: 'Mês anterior' }).click()
  await expect(hero).toContainText('Disponível em Agosto')
  const after = [await box(bar), await box(hero)]
  expect(after).toEqual(before)
})

test('resumo da fatura e lista de meses sem rolagem lateral', async ({
  page,
}, testInfo) => {
  await page.goto('/meses/2026-09')
  await page.getByRole('button', { name: /^Nubank Teste/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Fatura Nubank Teste' })
  await expect(dialog).toContainText('Entram sozinhas')
  await expect(dialog).toContainText('Gastos lançados')
  expect(
    await dialog.evaluate((node) => node.scrollWidth - node.clientWidth),
  ).toBe(0)
  await noSideScroll(page)
  await page.screenshot({ path: testInfo.outputPath('fatura.png') })
  await dialog.getByRole('button', { name: 'Cancelar' }).click()

  await page
    .getByRole('button', { name: 'Setembro 2026. Escolher mês' })
    .click()
  const list = page.getByRole('dialog', { name: 'Seus meses' })
  await expect(list.getByRole('button', { name: /Agosto 2026/ })).toBeVisible()
  expect(
    await list.evaluate((node) => node.scrollWidth - node.clientWidth),
  ).toBe(0)
})
