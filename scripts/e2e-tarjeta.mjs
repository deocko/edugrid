// Tarjeta virtual de la familia de punta a punta: rechaza tarjetas que no son de prueba,
// gira al escribir el código, guarda solo marca + últimos 4 + vencimiento y paga un cargo.
// Uso: con la app servida en QA_URL (por defecto vite preview), node scripts/e2e-tarjeta.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const BASE = process.env.QA_URL ?? 'http://localhost:4173/edugrid/'
const OUT = process.env.QA_OUT ?? 'qa-output'
mkdirSync(OUT, { recursive: true })

const step = (m) => console.log(`✓ ${m}`)
const fail = (m) => { throw new Error(m) }
const familia = { role: 'familia', personId: 'tu0', name: 'Laura Ortega Salinas' }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('edugrid.demo.db.v1')))
await page.goto(`${BASE}#/`)
await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('edugrid.demo.sesion', s) }, JSON.stringify(familia))
await page.goto(`${BASE}?v=1#/familia/tarjetas`)
await page.waitForLoadState('networkidle')

// 1. Una tarjeta válida pero que no es de prueba se rechaza
await page.getByLabel('Número de tarjeta').fill('4111 1111 1111 1111')
await page.getByLabel('Nombre como aparece en la tarjeta').fill('Laura Ortega')
await page.getByLabel('Vence (MM/AA)').fill('1229')
await page.getByLabel('Código de seguridad').fill('123')
await page.getByRole('button', { name: 'Guardar tarjeta' }).click()
await page.getByText('En la demo solo se aceptan tarjetas de prueba').waitFor()
if ((await db())?.cards?.length) fail('Se guardó una tarjeta que no es de prueba')
step('Una tarjeta que no es de prueba se rechaza y no se guarda')

// 2. Al escribir el código de seguridad la tarjeta se gira
await page.getByRole('button', { name: 'Visa', exact: true }).click()
await page.getByLabel('Código de seguridad').fill('')
await page.getByLabel('Código de seguridad').focus()
const rotated = await page.locator('[aria-label*="Reverso"]').count()
if (!rotated) fail('La tarjeta no se giró al escribir el código')
await page.getByLabel('Código de seguridad').fill('123')
await page.screenshot({ path: `${OUT}/tarjeta-reverso.png` })
step('Al escribir el código de seguridad la tarjeta muestra el reverso')

// 3. Se guarda solo lo indispensable
await page.getByRole('button', { name: 'Guardar tarjeta' }).click()
await page.getByText('Visa terminación 4242').waitFor()
const card = (await db()).cards[0]
const raw = JSON.stringify(await db())
if (!card || card.last4 !== '4242' || card.brand !== 'visa') fail('No se guardó la tarjeta')
if (raw.includes('4242424242424242') || 'cvv' in card || 'number' in card) fail('Se guardó el número completo o el código')
step('Se guardó la tarjeta: solo marca, últimos 4 y vencimiento (sin número completo ni código)')

// 4. La tarjeta guardada se gira con el botón
await page.getByRole('button', { name: 'Girar', exact: true }).first().click()
if ((await page.getByRole('button', { name: 'Girar', exact: true }).first().getAttribute('aria-pressed')) !== 'true') fail('El botón Girar no cambió')
await page.screenshot({ path: `${OUT}/tarjeta-guardada.png`, fullPage: true })
step('La tarjeta guardada se puede girar')

// 5. Pagar un cargo con la tarjeta
await page.goto(`${BASE}?v=2#/familia/pagos`)
await page.waitForLoadState('networkidle')
const before = (await db()).payments.length
await page.getByRole('button', { name: /^Pagar .* con tarjeta$/ }).first().click()
const dlg = page.getByRole('dialog')
await dlg.getByRole('button', { name: /^Pagar \$/ }).click()
await page.getByText('Pago aplicado').waitFor()
const after = await db()
const p = after.payments[after.payments.length - 1]
if (after.payments.length !== before + 1 || p.method !== 'tarjeta' || !p.reference.startsWith('DEMO-TAR-')) fail('No se registró el pago con tarjeta')
step(`Pago con tarjeta aplicado (${p.reference})`)

if (errors.length) fail(`Errores en la página: ${errors.join(' | ')}`)
await browser.close()
console.log('Tarjeta virtual completa sin errores.')
