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

test('lançar um Uber de R$ 12 no cartão em menos de 5 segundos e desfazer', async ({
  page,
}) => {
  await page.goto('/meses/2026-09')
  const nubank = page.getByRole('button', { name: /^Nubank Teste/ })
  await expect(nubank).toContainText('Uber R$ 12')

  const start = Date.now()
  await page.getByRole('button', { name: 'Lançar gasto ou entrada' }).click()
  const dialog = page.getByRole('dialog', { name: 'Lançar' })
  await expect(dialog.getByLabel('Valor')).toBeFocused()
  await page.keyboard.type('12')
  await dialog.getByLabel('Descrição').fill('Uber')
  await dialog.getByText('Nubank Teste').click()
  await dialog.getByRole('button', { name: 'Lançar' }).click()
  const toast = page.locator('.toast')
  await expect(toast).toContainText('na fatura Nubank Teste')
  expect(Date.now() - start).toBeLessThan(5000)
  // Two Ubers now, shown together in the composition.
  await expect(nubank).toContainText('2 gastos R$ 24')

  await toast.getByRole('button', { name: 'Desfazer' }).click()
  await expect(nubank).toContainText('Uber R$ 12')
  await saved(page)
  await page.reload()
  await expect(nubank).toContainText('Uber R$ 12')
  await expect(nubank).not.toContainText('2 gastos')

  // Launch again and keep it: it survives a reload.
  await page.getByRole('button', { name: 'Lançar gasto ou entrada' }).click()
  await page.keyboard.type('12')
  await dialog.getByRole('button', { name: 'Lançar' }).click()
  await saved(page)
  await page.reload()
  await expect(nubank).toContainText('2 gastos R$ 24')
})

test('cartão: dia de fechamento, cor e foto ficam gravados', async ({
  page,
}) => {
  await page.goto('/cartoes?mes=2026-09')
  await page.getByRole('button', { name: 'Editar Nubank Teste' }).click()
  const dialog = page.getByRole('dialog', { name: 'Editar cartão' })
  await dialog.getByLabel('Dia de fechamento (opcional)').fill('5')
  await dialog.getByRole('radio', { name: 'Cor #11C76F' }).check()

  // A real photo goes to the private bucket, through the same input a person uses.
  await dialog.locator('input[type=file]').evaluate(async (input) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 760
    const context = canvas.getContext('2d')!
    context.fillStyle = '#2b39b3'
    context.fillRect(0, 0, 1200, 760)
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((value) => resolve(value!), 'image/png'),
    )
    const files = new DataTransfer()
    files.items.add(new File([blob], 'cartao.png', { type: 'image/png' }))
    ;(input as HTMLInputElement).files = files.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect(dialog.getByRole('button', { name: 'Tirar foto' })).toBeVisible()
  await expect(dialog.locator('.card-art img')).toBeVisible()
  await dialog.getByRole('button', { name: 'Salvar' }).click()
  await saved(page)

  await page.reload()
  const thumbnail = page
    .getByRole('region', { name: 'Nubank Teste' })
    .locator('.card-art img')
  await expect(thumbnail).toBeVisible()
  expect(
    await thumbnail.evaluate(
      (image) => (image as HTMLImageElement).naturalWidth,
    ),
  ).toBe(900)
  await page.getByRole('button', { name: 'Editar Nubank Teste' }).click()
  await expect(dialog.getByLabel('Dia de fechamento (opcional)')).toHaveValue(
    '5',
  )
  await dialog.getByRole('button', { name: 'Tirar foto' }).click()
  await expect(
    dialog.getByRole('button', { name: 'Colocar foto' }),
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await saved(page)
  await page.reload()
  await expect(
    page.getByRole('region', { name: 'Nubank Teste' }).locator('.card-art img'),
  ).toHaveCount(0)

  // With closing day 5, Lançar suggests the month after this one when today is later.
  await page.getByRole('button', { name: 'Lançar gasto ou entrada' }).click()
  const launch = page.getByRole('dialog', { name: 'Lançar' })
  await launch.getByText('Nubank Teste').click()
  const day = Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
    }).format(new Date()),
  )
  if (day > 5)
    await expect(launch.getByLabel('Entra em')).not.toHaveValue('2026-09')
  await launch.getByRole('button', { name: 'Cancelar' }).click()
})

test('assinatura nova e parcelamento editado ficam gravados', async ({
  page,
}) => {
  await page.goto('/assinaturas')
  await page.getByRole('button', { name: 'Adicionar assinatura' }).click()
  const sub = page.getByRole('dialog', { name: 'Nova assinatura' })
  await sub.getByLabel('Assinatura').fill('Música')
  await sub.getByLabel('Dia da cobrança').fill('20')
  await sub.getByLabel('Valor').fill('21,90')
  await sub.getByLabel('Cartão').selectOption({ label: 'Nubank Teste' })
  await sub.getByRole('button', { name: 'Salvar' }).click()
  await saved(page)
  await page.reload()
  await expect(
    page.getByRole('button', { name: /^dia 20 Música/ }),
  ).toBeVisible()

  await page.goto('/cartoes?mes=2026-09')
  await page.getByRole('button', { name: /^Notebook/ }).click()
  const plan = page.getByRole('dialog', { name: 'Editar parcelamento' })
  await plan.getByLabel('O que é').fill('Notebook novo')
  await plan.getByRole('button', { name: 'Salvar' }).click()
  await saved(page)
  await page.reload()
  await expect(
    page.getByRole('button', { name: /^Notebook novo/ }),
  ).toBeVisible()
})
