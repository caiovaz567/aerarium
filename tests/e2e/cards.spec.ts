import { expect, test, type Page } from '@playwright/test'
import { E2E, LONG_CARD } from './fixture'
import { signedIn } from './session'

// Read only: every project, in parallel. Data: tests/e2e/fixture.ts.
signedIn()

const SHORT = 'jan fev mar abr mai jun jul ago set out nov dez'.split(' ')
/** Chart label of a month, like the app ("set", "jan/27"). */
const label = (ym: string) =>
  SHORT[Number(ym.slice(5)) - 1]! +
  (ym.endsWith('-01') ? `/${ym.slice(2, 4)}` : '')
function todayMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((part) => part.type === type)!.value
  return `${get('year')}-${get('month')}`
}
const shift = (ym: string, delta: number) => {
  const date = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5)) - 1 + delta)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const noSideScroll = async (page: Page) => {
  const widths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  expect(widths.content).toBeLessThanOrEqual(widths.viewport)
}

/** Distance between the selected month label and the middle of the strip. */
async function offCentre(page: Page) {
  return page.evaluate(() => {
    const strip = document
      .querySelector('.chart-strip')!
      .getBoundingClientRect()
    const on = document
      .querySelector('.month-label.on')!
      .getBoundingClientRect()
    return Math.abs(on.left + on.width / 2 - (strip.left + strip.width / 2))
  })
}
const selectedLabel = (page: Page) =>
  page.locator('.month-label.on').textContent()

async function openCard(page: Page) {
  await page.goto(`/cartoes/${E2E.card1}`)
  await expect(page.locator('.chart-strip svg')).toBeVisible()
}

test('aba Cartões: resumo, blocos e nome longo sem "…"', async ({
  page,
}, testInfo) => {
  await page.goto('/cartoes?mes=2026-09')
  const hero = page.getByRole('region', { name: 'Resumo dos cartões' })
  await expect(hero).toContainText('Faturas de Setembro')
  expect(
    (await hero.locator('.hero-num').textContent())?.replace(/\s/g, ' '),
  ).toBe('R$ 442,92')
  const title = page.locator('.card-title b', { hasText: LONG_CARD })
  expect(
    await title.evaluate((node) => node.scrollWidth > node.clientWidth),
  ).toBe(false)
  await noSideScroll(page)
  await page.screenshot({
    path: testInfo.outputPath('cartoes.png'),
    fullPage: true,
  })
})

test('gráfico abre com o mês atual no centro', async ({ page }, testInfo) => {
  await openCard(page)
  expect(await selectedLabel(page)).toBe(label(todayMonth()))
  await expect.poll(() => offCentre(page)).toBeLessThan(2)
  await noSideScroll(page)
  await page.screenshot({
    path: testInfo.outputPath('cartao.png'),
    fullPage: true,
  })
})

test('tocar num mês desliza até ele ficar no centro', async ({ page }) => {
  await openCard(page)
  const target = shift(todayMonth(), -2)
  await page.locator(`rect.hit[data-month="${target}"]`).click()
  await expect.poll(() => selectedLabel(page)).toBe(label(target))
  await expect.poll(() => offCentre(page)).toBeLessThan(2)
  const names =
    'Janeiro Fevereiro Março Abril Maio Junho Julho Agosto Setembro Outubro Novembro Dezembro'.split(
      ' ',
    )
  await expect(page.locator('.chart-head > small')).toContainText(
    `${names[Number(target.slice(5)) - 1]} ${target.slice(0, 4)}`,
  )
})

test('arrastar e soltar encaixa no mês mais perto do centro', async ({
  page,
}) => {
  await openCard(page)
  const slot = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('.month-label')]
    return (
      labels[1]!.getBoundingClientRect().left -
      labels[0]!.getBoundingClientRect().left
    )
  })
  // Drag about one and a half months to the right, then let go.
  await page.evaluate(
    (distance) => {
      const strip = document.querySelector('.chart-strip')!
      strip.scrollLeft += distance
    },
    Math.round(slot * 1.4),
  )
  await expect
    .poll(() => selectedLabel(page))
    .toBe(label(shift(todayMonth(), 1)))
  await expect.poll(() => offCentre(page)).toBeLessThan(2)
})

test('trocar de mês não muda a altura de nada acima nem do gráfico', async ({
  page,
}) => {
  await openCard(page)
  const measure = () =>
    page.evaluate(() =>
      ['.card-hero', '.card-chart', '.chart-strip'].map((selector) => {
        const box = document.querySelector(selector)!.getBoundingClientRect()
        return [Math.round(box.top + window.scrollY), Math.round(box.height)]
      }),
    )
  const before = await measure()
  for (const delta of [-1, -2, -6, 3]) {
    await page
      .locator(`rect.hit[data-month="${shift(todayMonth(), delta)}"]`)
      .click()
    await expect.poll(() => offCentre(page)).toBeLessThan(2)
    // Up to 1px is sub-pixel rounding of the scroll position, not a jump.
    const after = await measure()
    after
      .flat()
      .forEach((value, index) =>
        expect(Math.abs(value - before.flat()[index]!)).toBeLessThanOrEqual(1),
      )
  }
})

test('girar o celular redesenha e mantém o mês no centro', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Giro de tela é no celular.')
  await openCard(page)
  const target = shift(todayMonth(), -1)
  await page.locator(`rect.hit[data-month="${target}"]`).click()
  await expect.poll(() => offCentre(page)).toBeLessThan(2)
  const before = await page.locator('.chart-strip svg').getAttribute('width')
  await page.setViewportSize({ width: 844, height: 390 })
  await expect
    .poll(() => page.locator('.chart-strip svg').getAttribute('width'))
    .not.toBe(before)
  expect(await selectedLabel(page)).toBe(label(target))
  await expect.poll(() => offCentre(page)).toBeLessThan(2)
  await noSideScroll(page)
})

test('teclado: setas andam um mês e Esc volta', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Teclado é no computador.')
  await openCard(page)
  await page.keyboard.press('ArrowRight')
  await expect
    .poll(() => selectedLabel(page))
    .toBe(label(shift(todayMonth(), 1)))
  await expect.poll(() => offCentre(page)).toBeLessThan(2)
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/cartoes$/)
})
