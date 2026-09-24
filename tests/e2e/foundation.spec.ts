import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { writeFile, unlink } from 'node:fs/promises'

const background = { light: 'rgb(241, 242, 246)', dark: 'rgb(13, 15, 21)' }

test('abre nos dois temas, sem erros nem rolagem lateral', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto('/')
  await expect(page).toHaveTitle('Aerarium')
  await expect(
    page.getByRole('heading', { name: 'Aerarium', level: 1 }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Suas finanças, mês a mês.' }),
  ).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  const theme = testInfo.project.use.colorScheme === 'dark' ? 'dark' : 'light'
  await expect(page.locator('html')).toHaveCSS(
    'background-color',
    background[theme],
  )
  const layout = await page.evaluate(() => ({
    contentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    fonts:
      document.fonts.check('800 21px "Bricolage Grotesque"') &&
      document.fonts.check('400 15px Figtree'),
  }))
  expect(layout.contentWidth).toBeLessThanOrEqual(layout.viewportWidth)
  expect(layout.fonts).toBe(true)
  expect(errors).toEqual([])
  await page.screenshot({
    path: testInfo.outputPath('foundation.png'),
    fullPage: true,
  })
})

test('data-theme prevalece sobre o tema do sistema', async ({ page }) => {
  await page.goto('/')
  for (const theme of ['dark', 'light'] as const) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value
    }, theme)
    await expect(page.locator('html')).toHaveCSS(
      'background-color',
      background[theme],
    )
  }
})

test('atalho de teclado leva ao conteúdo', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Navegação por teclado validada no computador.')
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('link', { name: 'Ir para o conteúdo' }),
  ).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
})

test('servidor não entrega arquivos de backup', async ({ request }) => {
  const filename = `aerarium-backup-test-${randomUUID()}.json`
  await writeFile(filename, '{"fixture":true}', { flag: 'wx' })
  try {
    const response = await request.get(`/${filename}`)
    expect(response.status()).toBe(403)
  } finally {
    await unlink(filename)
  }
})
