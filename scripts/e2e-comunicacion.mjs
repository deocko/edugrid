// Flujo de comunicación escuela-familia de punta a punta:
// QR con cámara (simulada) y con código → entrada/salida → notificación a la familia →
// novedad con foto → chat docente-familia → alta de familia con dos hijos → aulas y clases.
// Uso: con la app servida en QA_URL (por defecto vite preview), node scripts/e2e-comunicacion.mjs
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const BASE = process.env.QA_URL ?? 'http://localhost:4173/edugrid/'
const OUT = process.env.QA_OUT ?? 'qa-output'
mkdirSync(OUT, { recursive: true })
const seed = JSON.parse(readFileSync(new URL('../src/data/seed.json', import.meta.url), 'utf8'))
const code = (id) => seed.students.find((s) => s.id === id).qrCode

const step = (m) => console.log(`✓ ${m}`)
const fail = (m) => { throw new Error(m) }
const S = {
  admin: { role: 'admin', personId: 'adm1', name: 'Mtra. Patricia Ruiz' },
  docente: { role: 'docente', personId: 't14', name: 'Carmen Escobedo Salinas' },
  familia: { role: 'familia', personId: 'tu0', name: 'Laura Ortega Salinas' },
}

// 1. Cámara simulada: un video con el QR de Regina impreso en pantalla
const browser0 = await chromium.launch()
const p0 = await browser0.newPage({ viewport: { width: 1280, height: 900 } })
await p0.goto(`${BASE}#/`)
await p0.waitForLoadState('networkidle')
await p0.evaluate((s) => localStorage.setItem('edugrid.demo.sesion', s), JSON.stringify(S.familia))
await p0.goto(`${BASE}?v=0#/familia/qr`)
await p0.waitForLoadState('networkidle')
await p0.locator('svg[aria-label^="Código QR de Regina"]').screenshot({ path: `${OUT}/qr-regina.png` })
await browser0.close()
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-i', `${OUT}/qr-regina.png`, '-vf', 'scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2:white,format=yuv420p', '-t', '3', '-r', '10', `${OUT}/qr-regina.y4m`])

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${OUT}/qr-regina.y4m`] })
// Hora de la escuela (el día demo es fijo, pero la hora sale del reloj): así la prueba no depende de la zona ni de la hora del equipo.
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['camera'], timezoneId: 'America/Mexico_City' })
const page = await ctx.newPage()
// Mediodía en la escuela: la regla de «escaneo repetido» compara con las entradas de la mañana de la semilla.
await ctx.clock.setSystemTime(new Date('2026-11-24T12:30:00-06:00'))
page.on('pageerror', (e) => { console.error('Error de página:', e.message); process.exitCode = 1 })
// Carga completa (cambia ?v) para que la app lea la sesión que se acaba de poner en el navegador
let n = 0
const go = async (path) => { await page.goto(`${BASE}?v=${++n}#${path}`); await page.waitForLoadState('networkidle') }
const as = async (who) => { await page.evaluate((s) => localStorage.setItem('edugrid.demo.sesion', s), JSON.stringify(S[who])) }

await go('/')
await page.evaluate(() => localStorage.clear())
await go('/')
await as('admin')
await go('/admin/entradas')
// Con el permiso de cámara ya dado, el escáner se abre solo al entrar (no hay que volver a tocar «Abrir cámara»)
await page.getByRole('button', { name: 'Apagar cámara' }).waitFor({ timeout: 10000 })
await page.getByText('Salida: Regina Méndez Ortega').waitFor({ timeout: 15000 })
step('Cámara: se abrió sola (permiso ya dado) y el QR de Regina registró su SALIDA (ya tenía entrada a las 07:42)')
await page.getByRole('button', { name: 'Apagar cámara' }).click()

// 2. Código escrito a mano: Mateo sale; volver a escanear al instante no duplica
await page.getByLabel('O escribe el código de la credencial').fill(code('al2').slice(0, 4).toLowerCase() + '-' + code('al2').slice(4))
await page.getByRole('button', { name: 'Registrar' }).click()
await page.getByText('Salida: Mateo Méndez Ortega').waitFor()
await page.getByLabel('O escribe el código de la credencial').fill(code('al2'))
await page.waitForTimeout(1600)
await page.getByRole('button', { name: 'Registrar' }).click()
await page.getByText('Ya quedó registrado').waitFor()
step('Código manual: salida de Mateo; una segunda lectura inmediata no se duplica')
await page.getByLabel('O escribe el código de la credencial').fill('ZZZZ-ZZZZ')
await page.waitForTimeout(1600)
await page.getByRole('button', { name: 'Registrar' }).click()
await page.getByText('No encontramos a ningún alumno con ese código.').waitFor()
step('Código inexistente: se rechaza con un mensaje claro')

// 3. Docente no puede registrar alumnos de otros grupos
await as('docente')
await go('/docente/entradas')
const other = seed.students.find((s) => s.groupId === 'gr-secundaria-1A')
await page.getByLabel('O escribe el código de la credencial').fill(other.qrCode)
await page.getByRole('button', { name: 'Registrar' }).click()
await page.getByText('Este alumno no es de tus grupos').waitFor()
step('Docente: no puede registrar a alumnos que no son de sus grupos')

// 4. Novedad con foto
await go('/docente/novedades')
await page.getByLabel('Alumno').selectOption('al1')
await page.getByRole('button', { name: 'Logro del día' }).click()
await page.getByLabel('Mensaje para la familia').fill('Regina terminó su maqueta y la presentó con mucha seguridad.')
// Foto de prueba generada (patrón de colores, sin personas)
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=1280x960', '-frames:v', '1', `${OUT}/foto-demo.jpg`])
await page.locator('input[type=file]').setInputFiles(`${OUT}/foto-demo.jpg`)
await page.getByAltText('Foto lista para enviar').waitFor()
await page.getByRole('button', { name: /Enviar a la familia de Regina/ }).click()
await page.getByText('la familia de Regina ya recibió la novedad').waitFor()
step('Docente envió una novedad con foto a la familia de Regina')

// 5. Familia: notificaciones de salida y novedad; foto en «Día a día»
await as('familia')
await go('/notificaciones')
for (const t of ['Regina salió de la escuela', 'Mateo salió de la escuela', 'Novedad de Regina']) await page.getByText(t).first().waitFor()
const bell = await page.getByRole('link', { name: /Notificaciones: \d+ sin leer/ }).getAttribute('aria-label')
step(`Familia recibió notificaciones de salida y de la novedad (${bell})`)
await page.getByText('Novedad de Regina').first().click()
await page.waitForURL(/familia\/hijo\/al1/)
await page.getByAltText(/Foto enviada por su docente/).first().waitFor()
step('La foto aparece en «Día a día» de Regina')
await go('/familia/calendario')
await page.getByText(/Regina: entró 07:42 y salió/).first().waitFor()
step('El calendario de la familia registra la entrada y la salida del día')

// 6. Chat: la familia escribe, la docente responde y queda «Visto»
await go('/familia/chat?c=ch1')
await page.getByLabel('Mensaje').fill('Gracias, maestra. Mañana la llevo.')
await page.getByRole('button', { name: 'Enviar' }).click()
await page.getByText('Gracias, maestra. Mañana la llevo.', { exact: true }).waitFor()
await as('docente')
await go('/docente/chat')
await page.getByRole('button', { name: /Laura Ortega Salinas/ }).getByLabel('1 sin leer').waitFor()
await page.getByRole('button', { name: /Laura Ortega Salinas/ }).click()
await page.getByLabel('Mensaje').fill('¡Perfecto, Laura! Nos vemos mañana.')
await page.keyboard.press('Enter')
await page.getByText('¡Perfecto, Laura! Nos vemos mañana.', { exact: true }).waitFor()
await as('familia')
await go('/familia/chat?c=ch1')
await page.getByText('¡Perfecto, Laura! Nos vemos mañana.', { exact: true }).waitFor()
await as('docente')
await go('/docente/chat?c=ch1')
await page.getByText('Gracias, maestra. Mañana la llevo.', { exact: true }).waitFor()
const seen = await page.locator('li.justify-end', { hasText: '¡Perfecto, Laura!' }).innerText()
if (!seen.includes('Visto')) fail('El mensaje de la docente no quedó como «Visto»')
step('Chat: mensaje de la familia, respuesta de la docente y acuse «Visto»')

// 7. Admin: alta de una familia con dos hijos y entrada con esa cuenta
await as('admin')
await go('/admin/familias')
await page.getByRole('button', { name: 'Dar de alta familia' }).click()
const dlg = page.getByRole('dialog')
await dlg.getByLabel('Nombre(s)').fill('Marta')
await dlg.getByLabel('Apellidos').fill('Prueba Demo')
await dlg.getByLabel('Teléfono celular').fill('55 2222 3333')
await dlg.getByLabel('Buscar alumno para agregar').fill('Regina Mé')
await dlg.getByRole('checkbox', { name: /Regina Méndez Ortega/ }).check()
await dlg.getByLabel('Buscar alumno para agregar').fill('Mateo Mé')
await dlg.getByRole('checkbox', { name: /Mateo Méndez Ortega/ }).check()
await dlg.getByRole('checkbox', { name: /aviso de privacidad/ }).check()
await dlg.getByRole('button', { name: 'Dar de alta' }).click()
await page.getByText('Marta Prueba Demo quedó registrada con 2 hijos').waitFor()
await page.getByRole('button', { name: 'Salir de la cuenta demo' }).click()
await page.waitForURL(/#\/$/)
await go('/demo')
const opt = page.locator('#cuenta-familia option', { hasText: 'Marta Prueba Demo · 2 hijos' })
await page.locator('#cuenta-familia').selectOption(await opt.getAttribute('value'))
await page.getByRole('button', { name: 'Entrar como Familia' }).click()
await page.waitForURL(/#\/familia$/)
for (const n of ['Regina Méndez Ortega', 'Mateo Méndez Ortega']) await page.getByRole('heading', { name: n }).waitFor()
step('Admin dio de alta a una mamá con 2 hijos y ella ya ve a ambos')

// 8. Aulas y clases
await as('admin')
await go('/admin/aulas')
await page.getByRole('button', { name: 'Agregar aula' }).click()
await page.getByRole('dialog').getByLabel('Nombre').fill('Salón 120')
await page.getByRole('dialog').getByLabel('Cupo (alumnos)').fill('25')
await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
await page.getByRole('heading', { name: 'Salón 120' }).waitFor()
step('Aulas: se agregó el Salón 120')
await go('/admin/clases')
await page.getByLabel('Grupo').selectOption('gr-primaria-4A')
await page.getByRole('button', { name: 'Agregar clase' }).click()
await page.getByRole('dialog').getByLabel('Día').selectOption('2')
await page.getByRole('dialog').getByLabel('Hora').selectOption('0')
await page.getByRole('dialog').getByRole('button', { name: 'Agregar al horario' }).click()
await page.getByText('El grupo ya tiene Ciencias Naturales el martes a esa hora.').waitFor()
await page.getByRole('dialog').getByLabel('Hora').selectOption('6')
await page.getByRole('dialog').getByRole('button', { name: 'Agregar al horario' }).click()
await page.getByText('13:30–14:20').first().waitFor()
step('Clases: no deja empalmar horarios y agrega la clase en un horario libre')

await browser.close()
console.log('Flujo de comunicación completo sin errores.')
