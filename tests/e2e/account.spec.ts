import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { signedIn } from './session'

// Fase 10: Ajustes, privacidade, sem internet. Nothing here writes data.
signedIn()

const noSideScroll = async (page: Page) => {
  const widths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  expect(widths.content).toBeLessThanOrEqual(widths.viewport)
}

test('ajustes e o modal de apagar conta, sem rolagem lateral', async ({
  page,
}, testInfo) => {
  await page.goto('/config')
  await expect(
    page.getByRole('button', { name: 'Baixar meus dados' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Editar categorias' }),
  ).toContainText('9 categorias')
  await noSideScroll(page)
  await page.screenshot({
    path: testInfo.outputPath('ajustes.png'),
    fullPage: true,
  })

  await page
    .getByRole('button', { name: 'Apagar minha conta e meus dados' })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Apagar sua conta?' })
  await expect(dialog.getByLabel('Digite APAGAR pra confirmar')).toBeFocused()
  await expect(
    dialog.getByRole('button', { name: 'Apagar tudo' }),
  ).toBeDisabled()
  await noSideScroll(page)
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((item) => item.finished)),
  )
  await page.screenshot({ path: testInfo.outputPath('apagar-conta.png') })
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialog).toBeHidden()
})

test('baixar meus dados entrega o JSON da conta', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Download é conferido no computador.')
  await page.goto('/config')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Baixar meus dados' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(
    /^Aerarium_dados_\d{4}-\d{2}-\d{2}\.json$/,
  )
  const data = JSON.parse(readFileSync(await download.path(), 'utf8'))
  expect(data.account.email).toBe(process.env.E2E_EMAIL)
  expect(data.cards.map((card: { name: string }) => card.name)).toContain(
    'Nubank Teste',
  )
  expect(data.months).toHaveLength(2)
  await expect(page.getByText('Seus dados foram baixados')).toBeVisible()
})

test('privacidade abre sem login e sem rolagem lateral', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    viewport: test.info().project.use.viewport,
  })
  const page = await context.newPage()
  await page.goto('/login')
  await page.getByRole('link', { name: 'Privacidade' }).click()
  await expect(page).toHaveURL(/\/privacidade$/)
  await expect(page.getByRole('heading', { name: 'Privacidade' })).toBeVisible()
  await noSideScroll(page)
  await page.screenshot({
    path: testInfo.outputPath('privacidade.png'),
    fullPage: true,
  })
  await context.close()
})

test('sem internet: aviso no topo, e o que falha volta com explicação', async ({
  page,
  context,
}) => {
  await page.goto('/meses/2026-09')
  await expect(page.getByText('Conta de luz').first()).toBeVisible()

  await context.setOffline(true)
  await expect(page.locator('.sync')).toHaveText('Sem internet')
  await page
    .getByRole('button', { name: 'Marcar como pago: Conta de luz' })
    .click()
  await expect(
    page.getByText('Não consegui salvar. Confere a internet e tenta de novo.'),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Marcar como pago: Conta de luz' }),
  ).toHaveAttribute('aria-pressed', 'false')

  await context.setOffline(false)
  await expect(page.locator('.sync')).not.toHaveText('Sem internet')
})

test('servidor fora do ar: mensagem com "Tentar de novo", nada de tela em branco', async ({
  page,
}) => {
  await page.route('**/rest/v1/**', (route) => route.abort())
  await page.goto('/meses/2026-09')
  // Three tries (about 3 s) before giving up.
  await expect(page.getByText('Não consegui carregar seus dados')).toBeVisible({
    timeout: 10_000,
  })
  await page.unroute('**/rest/v1/**')
  await page.getByRole('button', { name: 'Tentar de novo' }).click()
  await expect(page.getByText('Conta de luz').first()).toBeVisible()
})
