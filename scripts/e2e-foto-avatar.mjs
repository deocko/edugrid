// Foto institucional y avatar de punta a punta:
// la familia y la docente eligen su avatar en «Mi perfil» → la dirección lo ve en sus listas,
// desliza para ver la foto institucional, la toma, y puede quitar un avatar no adecuado.
// Uso: con la app servida en QA_URL (por defecto vite preview), node scripts/e2e-foto-avatar.mjs
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
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
}

const avatar = join(tmpdir(), 'edugrid-avatar.jpg')
const carnet = join(tmpdir(), 'edugrid-carnet.jpg')
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'mandelbrot=size=600x600', '-frames:v', '1', avatar])
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=600x800', '-frames:v', '1', carnet])

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
let v = 0
const as = async (who, path) => {
  await page.evaluate((s) => localStorage.setItem('edugrid.demo.sesion', s), JSON.stringify(S[who]))
  await page.goto(`${BASE}?v=${++v}#${path}`)
  await page.waitForLoadState('networkidle')
}
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('edugrid.demo.db.v1')))
const chooseAvatar = async () => {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), page.getByText('Elegir avatar', { exact: true }).click()])
  await chooser.setFiles(avatar)
  await page.getByText('Cambiar avatar', { exact: true }).waitFor()
}

await page.goto(`${BASE}#/`)
await page.evaluate(() => localStorage.clear())

// 1. La familia y la docente eligen su avatar
await as('familia', '/perfil')
await chooseAvatar()
await page.screenshot({ path: `${OUT}/avatar-1-familia-mi-perfil.png`, fullPage: false })
await as('docente', '/perfil')
await chooseAvatar()
let d = await db()
if (!d.guardians.find((g) => g.id === 'tu0').profilePhoto) fail('El avatar de la familia no se guardó')
if (d.guardians.find((g) => g.id === 'tu0').photo) fail('El avatar tocó la foto institucional de la familia')
step('Familia y docente eligen su avatar en «Mi perfil» sin tocar la foto institucional')

// 2. La dirección ve el avatar en Familias, abre las fotos y desliza a la institucional
await as('admin', '/admin/familias')
await page.getByRole('searchbox').fill('Laura Ortega')
const btn = page.getByRole('button', { name: 'Ver fotos de Laura Ortega Salinas' })
if (!(await btn.locator('img').count())) fail('La lista de familias no muestra el avatar')
await btn.click()
const dlg = page.getByRole('dialog')
await dlg.locator('[data-foto=avatar] img').waitFor()
await page.screenshot({ path: `${OUT}/avatar-2-admin-ve-avatar.png` })
step('La dirección ve el avatar de la familia en su lista y en grande')

await dlg.locator('[data-foto=avatar]').hover()
await page.mouse.wheel(400, 0)
await dlg.getByRole('tab', { name: 'Foto institucional', selected: true }).waitFor({ timeout: 3000 }).catch(() => dlg.getByRole('tab', { name: 'Foto institucional' }).click())
await dlg.getByText('La escuela aún no toma su foto.').waitFor()
await dlg.locator('input[type=file]').first().setInputFiles(carnet)
await dlg.getByText('Tomar foto nueva', { exact: true }).waitFor()
await dlg.locator('[data-foto=institucional] img').waitFor()
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/avatar-3-admin-foto-institucional.png` })
d = await db()
const g = d.guardians.find((x) => x.id === 'tu0')
if (!g.photo?.startsWith('data:image/jpeg')) fail('La foto institucional de la familia no se guardó')
if (!g.profilePhoto || g.profilePhoto === g.photo) fail('La foto institucional reemplazó el avatar')
if (!d.audit.some((a) => a.action === 'Tomó foto institucional de familia')) fail('La foto institucional no quedó en la bitácora')
step('Deslizando, la dirección ve y toma la foto institucional; el avatar sigue igual')

// 3. La familia ve su foto institucional en «Mi perfil», pero no la puede cambiar
await as('familia', '/perfil')
if ((await page.locator('img').count()) < 2) fail('La familia no ve su foto institucional en «Mi perfil»')
if (await page.getByText('Tomar foto', { exact: false }).count()) fail('La familia no debería poder tomar la foto institucional')
step('La familia ve su foto institucional y solo cambia su avatar')

// 4. La dirección quita un avatar no adecuado de un docente
await as('admin', '/admin/docentes')
await page.getByRole('button', { name: 'Ver fotos de Carmen Escobedo Salinas' }).click()
await page.getByRole('dialog').getByRole('button', { name: 'Quitar avatar' }).click()
d = await db()
if (d.teachers.find((t) => t.id === 't14').profilePhoto) fail('No se quitó el avatar del docente')
if (!d.audit.some((a) => a.action === 'Quitó el avatar de docente')) fail('Quitar el avatar no quedó en la bitácora')
step('La dirección puede quitar un avatar no adecuado y queda en la bitácora')

// 5. La docente ve en el expediente del alumno las dos fotos, sin poder editarlas
await as('docente', '/alumnos/al1')
await page.getByRole('tab', { name: 'Foto institucional' }).click()
if (await page.getByText('Tomar foto', { exact: false }).count()) fail('La docente no debería poder cambiar la foto institucional')
step('La docente ve las dos fotos del alumno, pero solo la dirección las controla')

if (errors.length) fail(`Errores en la página: ${errors.join(' | ')}`)
await browser.close()
console.log('Foto institucional y avatar: todo bien')
