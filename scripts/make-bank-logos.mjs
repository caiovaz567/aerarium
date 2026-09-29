// Draws the bank logos: a rounded tile in the bank's color with its mark,
// like an app icon. Marks come from Pluggy's public connector icons (and
// Simple Icons for banks Pluggy does not have). PNG, so they also work in
// e-mail. Run with `npm run banks`; the PNGs are committed. The list of banks
// the app knows is in src/domain/banks.ts and must match.
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const pluggy = (id) => `https://cdn.pluggy.ai/assets/connector-icons/${id}.svg`
const simple = (name) =>
  `https://cdn.jsdelivr.net/npm/simple-icons@13/icons/${name}.svg`

// white: paint the mark white; zoom: crop marks drawn inside their own tile.
const BANKS = [
  { key: 'nubank', src: pluggy(212), bg: '#820AD1', white: true },
  { key: 'itau', src: pluggy(201), bg: '#000066', zoom: 1.5 },
  { key: 'santander', src: pluggy(208), bg: '#EC0000', white: true },
  { key: 'bradesco', src: pluggy(203), bg: '#CC092F', white: true },
  { key: 'bb', src: pluggy(211), bg: '#FCE300' },
  { key: 'caixa', src: pluggy(219), bg: '#FFFFFF' },
  { key: 'inter', src: pluggy(215), bg: '#EA7100', zoom: 1.02 },
  { key: 'mercadopago', src: pluggy(206), bg: '#FFFFFF', zoom: 1.15 },
  { key: 'c6', src: pluggy(226), bg: '#242424', white: true },
  { key: 'btg', src: pluggy(214), bg: '#001E61', white: true },
  { key: 'picpay', src: pluggy(651), bg: '#11C76F', zoom: 1.5 },
  { key: 'digio', src: pluggy(653), bg: '#FFFFFF', zoom: 0.9 },
  {
    key: 'revolut',
    src: simple('revolut'),
    bg: '#000000',
    white: true,
    zoom: 0.5,
  },
]

const SIZE = 96
const tile = ({ bg, white, zoom = 1 }, svg) => `
<style>html,body{margin:0;background:transparent}</style>
<div id="t" style="width:${SIZE}px;height:${SIZE}px;border-radius:${SIZE * 0.23}px;overflow:hidden;background:${bg};display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px rgb(0 0 0 / 8%)">
  <img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"
    style="width:${zoom * 100}%;height:${zoom * 100}%;object-fit:contain;flex:none;${white ? 'filter:brightness(0) invert(1);' : ''}">
</div>`

const out = new URL('../public/banks/', import.meta.url)
await mkdir(out, { recursive: true })
const browser = await chromium.launch()
try {
  const page = await browser.newPage({
    viewport: { width: SIZE, height: SIZE },
  })
  for (const bank of BANKS) {
    const response = await fetch(bank.src)
    if (!response.ok) throw new Error(`${bank.key}: ${response.status}`)
    await page.setContent(tile(bank, await response.text()))
    await page.waitForLoadState('networkidle')
    const png = await page.locator('#t').screenshot({ omitBackground: true })
    await writeFile(new URL(`${bank.key}.png`, out), png)
    console.log(`public/banks/${bank.key}.png`)
  }
} finally {
  await browser.close()
}
