// Genera los PNG de la PWA a partir de los SVG de public/icons (usa Playwright local).
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
import { readFileSync } from 'node:fs'
const out = [
  ['icon.svg', 'icon-192.png', 192], ['icon.svg', 'icon-512.png', 512], ['icon.svg', 'apple-touch-icon.png', 180],
  ['maskable.svg', 'maskable-512.png', 512], ['icon.svg', 'favicon-32.png', 32],
]
const browser = await chromium.launch()
const page = await browser.newPage()
for (const [src, dest, size] of out) {
  const svg = readFileSync(new URL(`../public/icons/${src}`, import.meta.url), 'utf8')
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${size}" height="${size}">`)
  await page.screenshot({ path: new URL(`../public/icons/${dest}`, import.meta.url).pathname, omitBackground: true })
}
await browser.close()
console.log('Íconos generados')
