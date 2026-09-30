import { expect, test, type Page } from '@playwright/test'
import { signedIn } from './session'

// The e2e account has August and September 2026 (tests/e2e/fixture.ts).
const SEPTEMBER = '/meses/2026-09'
const ANY_MONTH = /\/meses\/\d{4}-\d{2}$/

signedIn()

const noSideScroll = async (page: Page) => {
  const widths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  expect(widths.content).toBeLessThanOrEqual(widths.viewport)
}

test('abas navegam, sem rolagem lateral em nenhuma tela', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page).toHaveURL(ANY_MONTH)
  const nav = page.getByRole('navigation', { name: 'Seções' })
  for (const [name, path] of [
    ['Cartões', /\/cartoes$/],
    ['Assinaturas', /\/assinaturas$/],
    ['Meses', ANY_MONTH],
  ] as const) {
    await nav.getByRole('link', { name }).click()
    await expect(page).toHaveURL(path)
    await expect(nav.getByRole('link', { name })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await noSideScroll(page)
    await page.screenshot({
      path: testInfo.outputPath(`${name.toLowerCase()}.png`),
    })
  }
  await page.getByRole('link', { name: 'Ajustes' }).click()
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
  await noSideScroll(page)
  expect(errors).toEqual([])
})

test('celular: barra flutuante embaixo, 5 espaços iguais e o + no meio', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Layout de celular.')
  await page.goto(SEPTEMBER)
  const viewport = page.viewportSize()!
  const nav = (await page
    .getByRole('navigation', { name: 'Seções' })
    .boundingBox())!
  // Floats a little above the bottom edge, inset from the sides.
  const gap = viewport.height - (nav.y + nav.height)
  expect(gap).toBeGreaterThan(4)
  expect(gap).toBeLessThan(20)
  expect(nav.x).toBeGreaterThanOrEqual(12)
  const tabs = await page
    .locator('.tab')
    .evaluateAll((items) =>
      items.map((item) => item.getBoundingClientRect().width),
    )
  expect(tabs).toHaveLength(4)
  expect(Math.max(...tabs) - Math.min(...tabs)).toBeLessThan(1)
  await expect(
    page.getByRole('banner').getByRole('link', { name: 'Ajustes' }),
  ).toBeHidden()
  const add = (await page
    .getByRole('button', { name: 'Lançar gasto ou entrada' })
    .boundingBox())!
  // Centered, inside the bar, never wider than a tab.
  expect(Math.abs(add.x + add.width / 2 - viewport.width / 2)).toBeLessThan(2)
  expect(add.y).toBeGreaterThanOrEqual(nav.y)
  expect(add.y + add.height).toBeLessThanOrEqual(nav.y + nav.height)
  expect(add.width).toBeLessThanOrEqual(tabs[0]!)
  // One theme button in the header.
  await expect(
    page.getByRole('button', { name: /^Tema: .* Tocar pra trocar$/ }),
  ).toBeVisible()
})

test('computador: coluna lateral com a marca, as abas e "Lançar" embaixo', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Layout de computador.')
  await page.goto(SEPTEMBER)
  const nav = (await page
    .getByRole('navigation', { name: 'Seções' })
    .boundingBox())!
  const content = (await page.locator('#conteudo').boundingBox())!
  expect(nav.x).toBeLessThan(40)
  expect(nav.height).toBeGreaterThan(500)
  expect(content.x).toBeGreaterThan(nav.x + nav.width)
  await expect(page.locator('.brand-side')).toBeVisible()
  await expect(page.getByRole('banner').locator('.brand')).toBeHidden()
  const add = page.getByRole('button', { name: 'Lançar gasto ou entrada' })
  await expect(add).toContainText('Lançar')
  const addBox = (await add.boundingBox())!
  const tabs = await page
    .locator('.tab')
    .evaluateAll((items) =>
      items.map((item) => item.getBoundingClientRect().bottom),
    )
  expect(addBox.y).toBeGreaterThan(Math.max(...tabs))
  // Light, dark or automatic, in the main area.
  const theme = page.getByRole('group', { name: 'Tema' })
  await expect(theme.getByRole('button')).toHaveCount(3)
  await theme.getByRole('button', { name: 'Claro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await theme.getByRole('button', { name: 'Escuro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await theme.getByRole('button', { name: 'Automático' }).click()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
})

test('modal abre no centro, sem rolagem lateral, e fecha', async ({
  page,
  isMobile,
}, testInfo) => {
  await page.goto(SEPTEMBER)
  await page.getByRole('button', { name: 'Lançar gasto ou entrada' }).click()
  const dialog = page.getByRole('dialog', { name: 'Lançar' })
  await expect(dialog).toBeVisible()
  await page.waitForTimeout(250)
  const box = (await dialog.boundingBox())!
  const viewport = page.viewportSize()!
  // Centered on the page, which keeps the scrollbar's space on a computer.
  const pageWidth = await page.evaluate(
    () => document.body.getBoundingClientRect().width,
  )
  expect(Math.abs(box.x + box.width / 2 - pageWidth / 2)).toBeLessThan(2)
  expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThan(
    30,
  )
  const overflow = await dialog.evaluate(
    (node) => node.scrollWidth - node.clientWidth,
  )
  expect(overflow).toBe(0)
  await noSideScroll(page)
  await page.screenshot({ path: testInfo.outputPath('modal.png') })
  await expect(dialog.getByLabel('Valor')).toBeFocused()
  if (isMobile) await dialog.getByRole('button', { name: 'Cancelar' }).click()
  else await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('barra de meses gruda abaixo do cabeçalho e só ela tem sombra', async ({
  page,
}, testInfo) => {
  await page.goto(SEPTEMBER)
  const header = page.getByRole('banner')
  const bar = page.locator('.stick')
  await expect(header).not.toHaveClass(/scrolled/)
  await expect(bar).not.toHaveClass(/stuck/)
  // Tall content so the page can scroll.
  await page.evaluate(() => {
    const spacer = document.createElement('div')
    spacer.style.height = '2000px'
    document.querySelector('main')!.append(spacer)
  })
  await page.evaluate(() => window.scrollTo(0, 600))
  await expect(bar).toHaveClass(/stuck/)
  await expect(header).toHaveClass(/scrolled/)
  const headerBox = (await header.boundingBox())!
  const barBox = (await bar.boundingBox())!
  expect(Math.abs(barBox.y - (headerBox.y + headerBox.height))).toBeLessThan(2)
  await expect(header).toHaveCSS('box-shadow', 'none')
  await expect(bar).not.toHaveCSS('box-shadow', 'none')
  await page.screenshot({ path: testInfo.outputPath('grudado.png') })
})

test('atalho de teclado leva ao conteúdo', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Navegação por teclado validada no computador.')
  await page.goto(SEPTEMBER)
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('link', { name: 'Ir para o conteúdo' }),
  ).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
})
