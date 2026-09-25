import { expect, test } from '@playwright/test'

// Runs against the production build (npm run build + preview), where the
// service worker exists. Project "pwa" in playwright.config.ts.

test('manifesto, ícones e metas do iPhone', async ({ page, request }) => {
  await page.goto('/login')
  const head = page.locator('head')
  await expect(
    head.locator('meta[name="apple-mobile-web-app-status-bar-style"]'),
  ).toHaveAttribute('content', 'black-translucent')
  await expect(
    head.locator('meta[name="apple-mobile-web-app-capable"]'),
  ).toHaveAttribute('content', 'yes')
  await expect(head.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    /viewport-fit=cover/,
  )

  const manifest = await (await request.get('/manifest.webmanifest')).json()
  expect(manifest).toMatchObject({
    name: 'Aerarium',
    short_name: 'Aerarium',
    display: 'standalone',
    start_url: '/',
    lang: 'pt-BR',
    theme_color: '#0D0F15',
    background_color: '#0D0F15',
  })
  const icons = [
    ...manifest.icons.map((icon: { src: string }) => icon.src),
    await head.locator('link[rel="apple-touch-icon"]').getAttribute('href'),
  ]
  expect(icons).toHaveLength(4)
  for (const src of icons) {
    const response = await request.get(src)
    expect(response.ok(), src).toBe(true)
    expect(response.headers()['content-type']).toBe('image/png')
  }
})

test('service worker guarda só a casca e abre sem internet', async ({
  page,
  context,
}) => {
  await page.goto('/login')
  await page.evaluate(() => navigator.serviceWorker.ready)
  // Wait until the precache is filled.
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const keys = await Promise.all(
          (await caches.keys()).map(async (name) =>
            (await (await caches.open(name)).keys()).map((r) => r.url),
          ),
        )
        return keys.flat()
      }),
    )
    .toContainEqual(expect.stringMatching(/\/index\.html/))

  const cached = await page.evaluate(async () => {
    const all = await Promise.all(
      (await caches.keys()).map(async (name) =>
        (await (await caches.open(name)).keys()).map((r) => r.url),
      ),
    )
    return all.flat()
  })
  // Financial data never goes to the cache: only files of the app itself.
  const origin = new URL(page.url()).origin
  expect(cached.every((url) => url.startsWith(origin))).toBe(true)
  expect(cached.some((url) => /supabase\.co/.test(url))).toBe(false)

  await context.setOffline(true)
  await page.goto('/meses')
  await expect(page.locator('.brand').first()).toBeVisible()
  await context.setOffline(false)
})
