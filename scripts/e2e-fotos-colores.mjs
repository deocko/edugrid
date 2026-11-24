// Foto del alumno y colores de materias de punta a punta:
// la dirección sube la foto → se ve en familia, lista y escáner; cambia el color de una
// materia → se ve igual en el horario del alumno, la familia y la docente.
// Uso: con la app servida en QA_URL (por defecto vite preview), node scripts/e2e-fotos-colores.mjs
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const BASE = process.env.QA_URL ?? 'http://localhost:4173/edugrid/'
const OUT = process.env.QA_OUT ?? 'qa-output'
mkdirSync(OUT, { recursive: true })
const seed = JSON.parse(readFileSync(new URL('../src/data/seed.json', import.meta.url), 'utf8'))
const regina = seed.students.find((s) => s.id === 'al1')

const step = (m) => console.log(`✓ ${m}`)
const fail = (m) => { throw new Error(m) }
const S = {
  admin: { role: 'admin', personId: 'adm1', name: 'Mtra. Patricia Ruiz' },
  docente: { role: 'docente', personId: 't14', name: 'Carmen Escobedo Salinas' },
  familia: { role: 'familia', personId: 'tu0', name: 'Laura Ortega Salinas' },
  alumno: { role: 'alumno', personId: 'al1', name: 'Regina Méndez Ortega' },
}

const photo = join(tmpdir(), 'edugrid-foto-prueba.jpg')
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=800x600', '-frames:v', '1', photo])

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

await page.goto(`${BASE}#/`)
await page.evaluate(() => localStorage.clear())

// 1. La dirección sube la foto de Regina
await as('admin', `/alumnos/${regina.id}`)
await page.locator('input[type=file]').setInputFiles(photo)
await page.getByRole('button', { name: 'Cambiar foto' }).waitFor()
const saved = (await db()).students.find((s) => s.id === regina.id).photo
if (!saved?.startsWith('data:image/jpeg')) fail('La foto no se guardó como JPEG')
if (saved.length > 60000) fail(`La foto pesa demasiado (${saved.length} caracteres)`)
step(`Dirección subió la foto (${Math.round(saved.length / 1024)} KB, recortada en cuadro)`)

await as('admin', '/admin/alumnos')
if ((await page.locator('img[src^="data:image/jpeg"]').count()) < 1) fail('La lista de alumnos no muestra la foto')
step('La foto aparece en la lista de alumnos')

// 2. La familia y la docente la ven
await as('familia', '/familia')
if ((await page.locator('img[src^="data:image/jpeg"]').count()) < 1) fail('La familia no ve la foto')
step('La familia ve la foto en la tarjeta de su hija')

await as('docente', '/docente/entradas')
await page.getByLabel(/código/i).first().fill(regina.qrCode)
await page.getByRole('button', { name: /Registrar/ }).first().click()
await page.locator('[aria-live=assertive] img').waitFor({ timeout: 5000 })
step('Al escanear, la docente ve la foto para confirmar quién es')

// 3. La dirección cambia el color de Matemáticas en todos los niveles
await as('admin', '/admin/escuela')
await page.getByRole('tab', { name: 'Materias' }).click()
await page.getByRole('button', { name: 'Matemáticas: cambiar color' }).first().click()
const dlg = page.getByRole('dialog')
await dlg.getByRole('radio', { name: 'Rosa' }).click()
if ((await dlg.getByRole('switch').getAttribute('aria-checked')) !== 'true') fail('El interruptor de todos los niveles debería venir encendido')
await dlg.getByRole('button', { name: 'Guardar color' }).click()
await dlg.waitFor({ state: 'detached' })
const mates = (await db()).subjects.filter((s) => s.name === 'Matemáticas')
if (mates.length < 2 || mates.some((s) => s.color !== 'rosa')) fail('No se aplicó el color a todos los niveles')
step(`Matemáticas quedó en rosa en ${mates.length} niveles`)

// 4. El mismo color en horario del alumno, de la familia y de la docente
const mateId = mates.find((s) => s.level === 'primaria').id
const countPink = () => page.locator('.subj-rosa').count()
await as('alumno', '/alumno/horario')
if ((await countPink()) < 1) fail('El horario del alumno no muestra Matemáticas en rosa')
await page.screenshot({ path: `${OUT}/colores-horario-alumno.png` })
await as('familia', `/familia/hijo/${regina.id}?vista=horario`)
if ((await countPink()) < 1) fail('El horario de la familia no muestra Matemáticas en rosa')
const teacher = seed.assignments.find((a) => a.subjectId === mateId && a.groupId === regina.groupId).teacherId
await page.evaluate((s) => localStorage.setItem('edugrid.demo.sesion', s), JSON.stringify({ role: 'docente', personId: teacher, name: 'Docente' }))
await page.goto(`${BASE}?v=${++v}#/docente/horario`)
await page.waitForLoadState('networkidle')
if ((await countPink()) < 1) fail('El horario de la docente no muestra Matemáticas en rosa')
step('Alumno, familia y docente ven Matemáticas del mismo color')

await as('familia', `/familia/hijo/${regina.id}?vista=calificaciones`)
if ((await countPink()) < 1) fail('Las calificaciones no muestran el color de la materia')
step('Las calificaciones usan el color de cada materia')

if (errors.length) fail(`Errores en la página: ${errors.join(' | ')}`)
await browser.close()
console.log('Fotos y colores completos sin errores.')
