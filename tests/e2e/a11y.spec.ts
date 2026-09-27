import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { E2E } from './fixture'
import { signedIn } from './session'

// Automatic WCAG 2.1 AA check (contrast, names,
// roles) on every screen, in both themes. Read only.
signedIn()

async function audit(page: Page) {
  // Mid-animation colors (the modal pop) would be measured wrong.
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((item) => item.finished)),
  )
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const found = result.violations.map(
    (item) =>
      `${item.id}: ${item.help}\n  ${item.nodes
        .slice(0, 4)
        .map((node) => node.target.join(' '))
        .join('\n  ')}`,
  )
  expect(found, found.join('\n')).toEqual([])
}

const SCREENS: [string, string, string][] = [
  ['Meses', '/meses/2026-09', 'Conta de luz'],
  ['Cartões', '/cartoes?mes=2026-09', 'Faturas de Setembro'],
  ['Cartão', `/cartoes/${E2E.card1}`, 'Nubank Teste'],
  ['Assinaturas', '/assinaturas', 'Streaming'],
  ['Ajustes', '/config', 'Baixar meus dados'],
  ['Privacidade', '/privacidade', 'O que o app guarda'],
]

for (const [name, path, ready] of SCREENS)
  test(`acessibilidade: ${name}`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByText(ready).first()).toBeVisible()
    await audit(page)
  })

test('acessibilidade: Lançar e resumo da fatura', async ({ page }) => {
  await page.goto('/meses/2026-09')
  await page.getByRole('button', { name: 'Lançar gasto ou entrada' }).click()
  await expect(page.getByRole('dialog', { name: 'Lançar' })).toBeVisible()
  await audit(page)
  await page.keyboard.press('Escape')
  // The row opens the summary; its check button is named "Marcar como pago…".
  await page.getByRole('button', { name: /^Nubank Teste/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await audit(page)
})

test('só com o teclado: pular pro conteúdo, lançar e fechar', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Teclado é no computador.')
  await page.goto('/meses/2026-09')
  await expect(page.getByText('Conta de luz').first()).toBeVisible()
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Ir para o conteúdo' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeInViewport()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#conteudo$/)

  const launch = page.getByRole('button', { name: 'Lançar gasto ou entrada' })
  await launch.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Lançar' })
  await expect(dialog).toBeVisible()
  // Focus stays inside the dialog while tabbing.
  for (let i = 0; i < 15; i++) await page.keyboard.press('Tab')
  expect(
    await dialog.evaluate((node) => node.contains(document.activeElement)),
  ).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(launch).toBeFocused()
})

test('acessibilidade: login', async ({ browser }) => {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    colorScheme: test.info().project.use.colorScheme,
  })
  const page = await context.newPage()
  await page.goto('/login')
  await expect(
    page.getByRole('button', { name: 'Entrar com Google' }),
  ).toBeVisible()
  await audit(page)
  await context.close()
})
