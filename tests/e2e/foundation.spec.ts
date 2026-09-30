import { expect, test, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { unlink, writeFile } from 'node:fs/promises'

const background = { light: 'rgb(244, 244, 245)', dark: 'rgb(10, 10, 10)' }

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

test('tela de entrar nos dois temas, sem erros nem rolagem lateral', async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page).toHaveTitle('Aerarium')
  await expect(
    page.getByRole('heading', { name: 'Aerarium', level: 1 }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Suas finanças, mês a mês.' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Entrar com Google' }),
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
      document.fonts.check('400 15px Inter'),
  }))
  expect(layout.contentWidth).toBeLessThanOrEqual(layout.viewportWidth)
  expect(layout.fonts).toBe(true)
  expect(errors).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('login.png') })
})

test('tela protegida sem sessão vai pro login', async ({ page }) => {
  await page.goto('/cartoes')
  await expect(page).toHaveURL(/\/login$/)
})

test('senha errada mostra o motivo', async ({ page }) => {
  test.skip(!process.env.E2E_EMAIL, 'Sem conta de teste.')
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(process.env.E2E_EMAIL!)
  await page.getByLabel('Senha', { exact: true }).fill('senha-errada-123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha errados.')
})

test('entra, cai no mês atual e sai', async ({ page }) => {
  test.skip(!process.env.E2E_EMAIL, 'Sem conta de teste.')
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(process.env.E2E_EMAIL!)
  await page
    .getByLabel('Senha', { exact: true })
    .fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/meses\/\d{4}-\d{2}$/)
  await page.getByRole('link', { name: 'Ajustes' }).click()
  await expect(page.getByText(process.env.E2E_EMAIL!)).toBeVisible()
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/cartoes')
  await expect(page).toHaveURL(/\/login$/)
})

test('data-theme prevalece sobre o tema do sistema', async ({ page }) => {
  await page.goto('/login')
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
