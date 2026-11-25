// Fluidez con la base de datos en línea y red lenta: guardar y moverse por el menú de abajo
// no debe trabar la app esperando al servidor.
// Uso: npm run build:servidor && EDUGRID_LATENCIA_MS=800 npm run servidor  y luego  node scripts/e2e-fluidez.mjs
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const BASE = process.env.QA_URL ?? 'http://localhost:3000/'
const LIMITE_MS = Number(process.env.LIMITE_MS ?? 600)
const fail = (m) => { throw new Error(m) }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
const errores = []
page.on('pageerror', (e) => errores.push(e.message))
let lecturas = 0
page.on('request', (r) => { if (r.url().includes('/api/datos') && r.method() === 'GET') lecturas++ })

await page.goto(`${BASE}#/`)
await page.evaluate(() => localStorage.setItem('edugrid.demo.sesion', JSON.stringify({ role: 'admin', personId: 'adm1', name: 'Mtra. Patricia Ruiz' })))
await page.goto(`${BASE}?v=1#/perfil`)
await page.getByRole('heading', { level: 1, name: 'Mi perfil' }).waitFor()

const t0 = Date.now()
await page.getByLabel('Correo electrónico').fill('direccion.demo@ejemplo.mx')
await page.getByLabel('Teléfono celular').fill('55-2222-3333')
await page.getByRole('button', { name: 'Guardar cambios' }).click()
await page.getByText('Cambios guardados').waitFor()
const guardar = Date.now() - t0

lecturas = 0
const barra = page.getByRole('navigation', { name: 'Navegación principal' }).last()
const enlaces = await barra.getByRole('link').all()
const tiempos = []
for (let vuelta = 0; vuelta < 3; vuelta++) {
  for (const enlace of enlaces) {
    const destino = await enlace.getAttribute('href')
    const t = Date.now()
    await enlace.click()
    await page.waitForFunction((h) => location.hash === h.replace(/^.*#/, '#'), destino)
    await page.locator('main h1').first().waitFor()
    tiempos.push({ destino, ms: Date.now() - t })
  }
}
const peor = tiempos.reduce((a, b) => (b.ms > a.ms ? b : a))
console.log(`Guardar perfil: ${guardar} ms (un viaje al servidor)`)
console.log(`Cambiar de sección (${tiempos.length} toques): peor ${peor.ms} ms en ${peor.destino}, promedio ${Math.round(tiempos.reduce((a, b) => a + b.ms, 0) / tiempos.length)} ms`)
console.log(tiempos.map((t) => `${t.destino.replace(/^.*#/, '')} ${t.ms}`).join(' · '))
if (peor.ms > LIMITE_MS) fail(`Cambiar de sección tardó ${peor.ms} ms (límite ${LIMITE_MS} ms)`)
if (lecturas) fail(`Moverse por el menú volvió a descargar los datos ${lecturas} veces`)
if (errores.length) fail(errores.join(' | '))
await browser.close()
console.log('Fluidez: todo en orden.')
