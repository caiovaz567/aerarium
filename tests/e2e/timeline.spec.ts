import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { signedIn } from './session'

// Saídas by date. Read only.
signedIn()

const noSideScroll = async (page: Page) => {
  const widths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  expect(widths.content).toBeLessThanOrEqual(widths.viewport)
}

test('Por data: dias, fixos, filtros e resumo, sem rolagem lateral', async ({
  page,
}, testInfo) => {
  await page.goto('/meses/2026-09')
  const saidas = page.getByRole('region', { name: 'Saídas' })
  await saidas.getByRole('button', { name: 'Por data' }).click()
  await expect(
    saidas.getByRole('region', { name: 'qui, 3 set' }),
  ).toContainText('Uber')
  await expect(
    saidas.getByRole('region', { name: 'Fixos do mês' }),
  ).toContainText('Conta de luz')
  await noSideScroll(page)
  await saidas.screenshot({ path: testInfo.outputPath('por-data.png') })

  await saidas
    .getByRole('group', { name: 'Filtrar por cartão' })
    .getByRole('button', { name: 'Fora do cartão' })
    .click()
  await expect(saidas.getByRole('region', { name: 'qui, 3 set' })).toBeHidden()
  await noSideScroll(page)
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(result.violations.map((item) => item.id)).toEqual([])

  // Meses always opens "Por tipo".
  await page.reload()
  await expect(
    page
      .getByRole('region', { name: 'Saídas' })
      .getByRole('button', { name: 'Por tipo' }),
  ).toHaveAttribute('aria-pressed', 'true')
})
