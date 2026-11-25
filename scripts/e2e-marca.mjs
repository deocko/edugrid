// Marca de cada escuela de punta a punta: la dirección elige una escuela de ejemplo o sube su logo
// y colores → todos los usuarios ven el logo de la escuela arriba y «by EDUGRID» al pie;
// la boleta en PDF sale con la marca; el catálogo de lugares de entrada llega al escáner.
// Uso: con la app servida en QA_URL (por defecto vite preview), node scripts/e2e-marca.mjs
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const BASE = process.env.QA_URL ?? 'http://localhost:4173/edugrid/'
const OUT = process.env.QA_OUT ?? 'qa-output'
mkdirSync(OUT, { recursive: true })

const step = (m) => console.log(`✓ ${m}`)
const fail = (m) => { throw new Error(m) }
const S = {
  admin: { role: 'admin', personId: 'adm1', name: 'Mtra. Patricia Ruiz' },
  docente: { role: 'docente', personId: 't14', name: 'Carmen Escobedo Salinas' },
  familia: { role: 'familia', personId: 'tu0', name: 'Laura Ortega Salinas' },
  alumno: { role: 'alumno', personId: 'al1', name: 'Regina Méndez Ortega' },
}
// Logo de prueba ficticio (SVG) que sube la dirección
const logoFile = join(tmpdir(), 'logo-escuela-prueba.svg')
writeFileSync(logoFile, '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100"><rect width="100" height="100" rx="20" fill="#5b2a86"/><text x="115" y="62" font-family="Arial" font-size="34" font-weight="700" fill="#5b2a86">PRUEBA</text></svg>')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
let v = 0
const as = async (who, path) => {
  await page.evaluate((s) => localStorage.setItem('edugrid.demo.sesion', s), JSON.stringify(S[who]))
  await page.goto(`${BASE}?v=${++v}#${path}`)
  await page.waitForLoadState('networkidle')
}
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('edugrid.demo.db.v1')))
const primaryVar = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--c-primary').trim())

await page.goto(`${BASE}#/`)
await page.evaluate(() => localStorage.clear())

// 1. Sin marca propia: logo de EDUGRID y colores del manual
await as('admin', '/admin/configuracion')
if ((await primaryVar()) !== '#1769d2') fail('Sin marca propia debería usar el azul EDUGRID')
step('Sin marca propia se usan el logo y los colores de EDUGRID')

// 2. Escuela de ejemplo: Colegio Arboleda
await page.getByRole('button', { name: /Colegio Arboleda/ }).click()
await page.getByText('En uso').waitFor()
const m = (await db()).meta
if (!m.branding.logo?.startsWith('data:image/png') || m.school.name !== 'Colegio Arboleda (DEMO)') fail('No se aplicó la escuela de ejemplo')
if ((await primaryVar()) !== '#1f7a4d') fail(`El color principal no cambió (${await primaryVar()})`)
await page.screenshot({ path: `${OUT}/marca-configuracion.png`, fullPage: true })
step('Escuela de ejemplo aplicada: logo y color verde de Arboleda')

// 3. Todos los roles ven el logo de la escuela y «by EDUGRID»
for (const who of ['docente', 'familia', 'alumno']) {
  await as(who, '/')
  if ((await page.locator('header img[alt="Colegio Arboleda (DEMO)"]').count()) < 1 && (await page.locator('aside img[alt="Colegio Arboleda (DEMO)"]').count()) < 1) fail(`${who} no ve el logo de la escuela`)
  if ((await page.getByText('by', { exact: false }).filter({ hasText: 'EDUGRID' }).count()) < 1) fail(`${who} no ve «by EDUGRID»`)
  if ((await primaryVar()) !== '#1f7a4d') fail(`${who} no ve los colores de la escuela`)
}
step('Docente, familia y alumno ven el logo de la escuela arriba y «by EDUGRID» al pie')

// 4. Pantalla de entrada con la marca de la escuela
await page.evaluate(() => localStorage.removeItem('edugrid.demo.sesion'))
await page.goto(`${BASE}?v=${++v}#/`)
await page.getByRole('heading', { level: 1, name: 'Colegio Arboleda (DEMO)' }).waitFor()
await page.screenshot({ path: `${OUT}/marca-login.png` })
step('La pantalla de entrada muestra el nombre y logo de la escuela')

// 5. Boleta en PDF con la marca
await as('familia', '/familia/hijo/al1?vista=calificaciones')
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /boleta/i }).first().click()])
const pdf = join(tmpdir(), 'boleta-marca.pdf')
await dl.saveAs(pdf)
step('La boleta en PDF se genera con la marca de la escuela')

// 6. Logo y colores propios
await as('admin', '/admin/configuracion')
await page.locator('input[type=file][accept*="svg"]').setInputFiles(logoFile)
await page.getByLabel('Color principal', { exact: true }).fill('#f2c94c')
await page.getByText('Oscurecimos un poco el color principal').waitFor()
await page.getByRole('button', { name: 'Guardar marca' }).click()
await page.getByText('Todos los usuarios de la escuela ya ven').waitFor()
const p = await primaryVar()
const lum = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }).reduce((a, x, i) => a + x * [0.2126, 0.7152, 0.0722][i], 0) }
const ratio = 1.05 / (lum(p) + 0.05)
if (ratio < 4.5) fail(`El amarillo no se ajustó: contraste ${ratio.toFixed(2)}`)
step(`Logo propio guardado; el amarillo claro se ajustó a ${p} (contraste ${ratio.toFixed(1)}:1 con texto blanco)`)

// 7. Catálogo de lugares de entrada (tarjeta «Entradas QR» de Configuración)
await as('admin', '/admin/lugares-qr')
await page.getByLabel('Nuevo lugar').fill('Puerta de estacionamiento')
await page.getByRole('button', { name: 'Agregar', exact: true }).click()
await page.getByRole('button', { name: 'Quitar Salón' }).click()
const places = (await db()).meta.checkinPlaces
if (!places.includes('Puerta de estacionamiento') || places.includes('Salón')) fail('No se actualizó el catálogo de lugares')
await as('docente', '/docente/entradas')
const opts = await page.getByLabel('Lugar').locator('option').allTextContents()
if (!opts.includes('Puerta de estacionamiento') || opts.includes('Salón')) fail(`El escáner no usa el catálogo: ${opts.join(', ')}`)
step('El catálogo de lugares de entrada llega al escáner de la docente')

// 8. Volver a EDUGRID
await as('admin', '/admin/configuracion')
await page.getByRole('button', { name: /Colegio Demo EDUGRID/ }).click()
await page.getByText('En uso').waitFor()
if ((await primaryVar()) !== '#1769d2' || (await db()).meta.branding.logo) fail('No se pudo volver a la marca EDUGRID')
step('Se puede volver a la marca EDUGRID')

if (errors.length) fail(`Errores en la página: ${errors.join(' | ')}`)
await browser.close()
console.log('Marca de escuela completa sin errores.')
