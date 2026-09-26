import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { signedIn } from './session'

// Fase 11: categories. Read only (the flow that writes is in flow.spec.ts).
signedIn()

const noSideScroll = async (page: Page) => {
  const widths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  expect(widths.content).toBeLessThanOrEqual(widths.viewport)
}
const settled = (page: Page) =>
  page.evaluate(() =>
    Promise.all(document.getAnimations().map((item) => item.finished)),
  )
async function audit(page: Page) {
  await settled(page)
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(result.violations.map((item) => item.id)).toEqual([])
}

test('"Para onde foi o dinheiro" em setembro, aberto e sem rolagem lateral', async ({
  page,
}, testInfo) => {
  await page.goto('/meses/2026-09')
  const block = page.getByRole('region', { name: 'Para onde foi o dinheiro' })
  await expect(block.getByRole('button', { name: /^Moradia/ })).toContainText(
    'R$ 180,35',
  )
  await block.getByRole('button', { name: /^Sem categoria/ }).click()
  await expect(block.getByRole('button', { name: /^Internet/ })).toBeVisible()
  await expect(block.getByRole('button', { name: /^Dentista/ })).toBeVisible()
  await noSideScroll(page)
  await block.scrollIntoViewIfNeeded()
  await block.screenshot({ path: testInfo.outputPath('categorias.png') })
  await audit(page)

  await block.getByRole('button', { name: /^Internet/ }).click()
  const form = page.getByRole('dialog', { name: 'Editar conta' })
  await expect(form.getByRole('group', { name: 'Categoria' })).toBeVisible()
  await expect(form.getByLabel('Sem categoria')).toBeChecked()
  await noSideScroll(page)
  await audit(page)
})

test('Lançar sugere a categoria pelo nome', async ({ page }, testInfo) => {
  await page.goto('/meses/2026-09')
  await page.getByRole('button', { name: 'Lançar gasto ou entrada' }).click()
  const form = page.getByRole('dialog', { name: 'Lançar' })
  await form.getByLabel('Descrição').fill('iFood')
  await expect(form.getByLabel('Alimentação')).toBeChecked()
  expect(
    await form.evaluate((node) => node.scrollWidth - node.clientWidth),
  ).toBe(0)
  await noSideScroll(page)
  await settled(page)
  await page.screenshot({ path: testInfo.outputPath('lancar-categoria.png') })
  await audit(page)
})

test('Ajustes: editar categorias, sem rolagem lateral', async ({
  page,
}, testInfo) => {
  await page.goto('/config')
  await page.getByRole('button', { name: 'Editar categorias' }).click()
  const form = page.getByRole('dialog', { name: 'Categorias' })
  await expect(form.getByLabel('Nome da categoria Transporte')).toHaveValue(
    'Transporte',
  )
  await noSideScroll(page)
  await settled(page)
  await page.screenshot({ path: testInfo.outputPath('editar-categorias.png') })
  await audit(page)
  await form.getByRole('button', { name: 'Pronto' }).click()
  await expect(form).toBeHidden()
})
