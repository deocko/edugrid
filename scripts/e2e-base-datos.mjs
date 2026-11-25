// La app conectada a la base de datos (modo Vercel), de punta a punta en el navegador:
// restablecer carga la semilla en la base, lo que guarda una persona lo ve otra en otro
// dispositivo, la foto de perfil se guarda y el inicio de sesión queda en la bitácora.
// Uso: npm run build:servidor && npm run servidor  y luego  node scripts/e2e-base-datos.mjs
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const BASE = process.env.QA_URL ?? 'http://localhost:3000/'

const step = (m) => console.log(`✓ ${m}`)
const fail = (m) => { throw new Error(m) }
const familia = { role: 'familia', personId: 'tu0', name: 'Laura Ortega Salinas' }
// Postgres (jsonb) guarda las llaves de cada objeto en su propio orden: se comparan ordenadas.
const canon = (x) => JSON.stringify(x, (_, val) => (val && typeof val === 'object' && !Array.isArray(val) ? Object.fromEntries(Object.entries(val).sort(([p], [q]) => (p < q ? -1 : 1))) : val))
const seed = JSON.parse(readFileSync('src/data/seed.json', 'utf8'))
const servidor = async () => {
  const r = await fetch(new URL('api/datos', BASE))
  if (!r.ok) fail(`La API respondió ${r.status}`)
  return r.json()
}

// Los cambios viajan al servidor por detrás: se espera (hasta 10 s) a que la base los tenga.
const enLaBase = async (cond, msg) => {
  const fin = Date.now() + 10000
  for (;;) {
    const d = await servidor()
    if (cond(d)) return d
    if (Date.now() > fin) fail(msg)
    await new Promise((r) => setTimeout(r, 250))
  }
}

const browser = await chromium.launch()
const errors = []
const nuevaPagina = async (viewport = { width: 1280, height: 900 }) => {
  const ctx = await browser.newContext({ viewport })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  return page
}
let v = 0
const entrarComo = async (page, sesion, path) => {
  await page.goto(`${BASE}#/`)
  await page.evaluate((s) => localStorage.setItem('edugrid.demo.sesion', s), JSON.stringify(sesion))
  await page.goto(`${BASE}?v=${++v}#${path}`)
  await page.waitForLoadState('networkidle')
}

// 1. «Restablecer datos demo» deja la base igual que la semilla del repositorio
const a = await nuevaPagina()
await a.goto(`${BASE}#/`)
await a.getByText('Datos: Base de datos en línea').waitFor()
await a.getByRole('button', { name: 'Restablecer datos demo' }).click()
await a.getByRole('button', { name: 'Sí, restablecer' }).click()
await a.getByText('Listo: los datos demo se restablecieron').waitFor()
const tras = await servidor()
for (const t of ['students', 'guardians', 'charges', 'gradeRecords', 'attendance'])
  if (canon(tras[t]) !== canon(seed[t])) fail(`La tabla ${t} no quedó igual a la semilla`)
if (await a.evaluate(() => localStorage.getItem('edugrid.demo.db.v1'))) fail('Con base de datos no se deben guardar los datos en el navegador')
step('Restablecer datos demo carga la semilla en la base de datos (nada se guarda en el navegador)')

// 2. Iniciar sesión desde la pantalla queda en la bitácora de la base
await a.getByRole('button', { name: /Entrar como Administrador/ }).first().click()
await enLaBase((d) => d.audit.some((x) => x.action === 'Inició sesión' && x.role === 'admin'), 'El inicio de sesión no llegó a la bitácora de la base')
step('El inicio de sesión del administrador se guardó en la bitácora de la base')

// 3. La familia guarda su correo, teléfono y foto en un celular...
const cel = await nuevaPagina({ width: 390, height: 844 })
await entrarComo(cel, familia, '/perfil')
await cel.getByRole('heading', { level: 1, name: 'Mi perfil' }).waitFor()
await cel.getByLabel('Correo electrónico').fill('laura.bd@ejemplo.mx')
await cel.getByLabel('Teléfono celular').fill('55-8765-4321')
await cel.getByRole('button', { name: 'Guardar cambios' }).click()
await cel.getByText('Cambios guardados').waitFor()
const png = Buffer.from(await cel.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#35c5d9'; x.fillRect(0, 0, 200, 200); return c.toDataURL('image/png').split(',')[1] }), 'base64')
const [chooser] = await Promise.all([cel.waitForEvent('filechooser', { timeout: 5000 }), cel.getByText('Elegir avatar', { exact: true }).click()])
await chooser.setFiles({ name: 'perfil.png', mimeType: 'image/png', buffer: png })
await cel.getByText('Cambiar avatar', { exact: true }).waitFor()
const tu0 = (d) => d.guardians.find((g) => g.id === 'tu0')
await enLaBase((d) => tu0(d).email === 'laura.bd@ejemplo.mx' && tu0(d).phone === '5587654321', 'El correo y el teléfono no llegaron a la base')
await enLaBase((d) => tu0(d).profilePhoto?.startsWith('data:image/'), 'La foto de perfil no llegó a la base')
step('La familia guarda correo, teléfono y foto de perfil y quedan en la base de datos')

// 4. ...y en otro dispositivo (otro navegador, sin nada guardado) aparecen igual
const compu = await nuevaPagina()
await entrarComo(compu, familia, '/perfil')
await compu.getByRole('heading', { level: 1, name: 'Mi perfil' }).waitFor()
if ((await compu.getByLabel('Correo electrónico').inputValue()) !== 'laura.bd@ejemplo.mx') fail('El otro dispositivo no ve el correo guardado')
await compu.getByText('Cambiar avatar', { exact: true }).waitFor()
step('Otro dispositivo abre el perfil y ve el mismo correo y la misma foto')

// 5. Si el servidor no puede guardar, la app lo dice y no muestra «Cambios guardados»
await compu.route('**/api/datos', (route) => route.request().method() === 'POST'
  ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'No se pudo conectar con la base de datos. Intenta de nuevo en un momento.' }) })
  : route.continue())
await compu.getByLabel('Teléfono celular').fill('55-1111-2222')
await compu.getByRole('button', { name: 'Guardar cambios' }).click()
await compu.getByRole('alert').filter({ hasText: 'No se guardó el cambio' }).waitFor()
if (await compu.getByText('Cambios guardados').isVisible()) fail('Dijo «Cambios guardados» aunque el servidor falló')
if ((await servidor()).guardians.find((g) => g.id === 'tu0').phone !== '5587654321') fail('Un cambio fallido modificó la base')
step('Si el servidor falla, aparece «No se guardó el cambio» y la base no cambia')

// 6. Al volver a restablecer, los cambios se van y regresa la semilla
await a.goto(`${BASE}#/`)
await a.evaluate(() => localStorage.removeItem('edugrid.demo.sesion'))
await a.goto(`${BASE}?v=${++v}#/`)
await a.getByRole('button', { name: 'Restablecer datos demo' }).click()
await a.getByRole('button', { name: 'Sí, restablecer' }).click()
await a.getByText('Listo: los datos demo se restablecieron').waitFor()
const otraVez = (await servidor()).guardians.find((g) => g.id === 'tu0')
if (otraVez.email !== seed.guardians.find((g) => g.id === 'tu0').email) fail('Restablecer no regresó los datos de la semilla')
step('Restablecer de nuevo regresa los datos de ejemplo')

const reales = errors.filter((m) => !m.includes('No se pudo conectar con la base de datos'))
if (reales.length) fail(`Errores en la página: ${reales.join(' | ')}`)
await browser.close()
console.log('App con base de datos: todo en orden.')
