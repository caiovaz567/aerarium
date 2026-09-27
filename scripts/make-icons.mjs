// Draws the app icons: light temple on #3140C2, square corners
// (iOS rounds them itself). Run with `npm run icons`; the PNGs are committed.
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const TEMPLE =
  '<path d="M12 2.5 2.5 7.5h19z"/><rect x="3" y="9" width="18" height="1.8" rx=".6"/><rect x="5" y="12" width="2.4" height="6.5" rx=".6"/><rect x="10.8" y="12" width="2.4" height="6.5" rx=".6"/><rect x="16.6" y="12" width="2.4" height="6.5" rx=".6"/><rect x="2.5" y="19.7" width="19" height="2" rx=".6"/>'

/** `scale` is the share of the side the temple takes. */
const svg = (size, scale) => {
  const side = size * scale
  const offset = (size - side) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#3140C2"/><g transform="translate(${offset} ${offset}) scale(${side / 24})" fill="#FFFFFF">${TEMPLE}</g></svg>`
}

// Maskable icons are cropped to a circle of 80%, so the temple stays smaller.
const ICONS = [
  ['icon-192.png', 192, 0.62],
  ['icon-512.png', 512, 0.62],
  ['icon-maskable-512.png', 512, 0.5],
  ['apple-touch-icon.png', 180, 0.62],
]

const out = new URL('../public/icons/', import.meta.url)
await mkdir(out, { recursive: true })
const browser = await chromium.launch()
try {
  for (const [name, size, scale] of ICONS) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
    })
    await page.setContent(
      `<style>html,body{margin:0}</style>${svg(size, scale)}`,
    )
    await writeFile(new URL(name, out), await page.screenshot())
    await page.close()
    console.log(`public/icons/${name}`)
  }
  await writeFile(new URL('icon.svg', out), svg(512, 0.62) + '\n')
  console.log('public/icons/icon.svg')
} finally {
  await browser.close()
}
