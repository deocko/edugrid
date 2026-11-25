// Correcciones de la prueba en vivo (mensaje 8), de punta a punta en la app servida:
// datos idénticos tras restablecer dos veces, avisos y conteos de la familia, contador que baja al
// confirmar, clases del día de la docente, entrada con QR reflejada en asistencia, mismo promedio
// en las tres vistas y descarga de la boleta en PDF.
// Uso: con la app servida en QA_URL (por defecto vite preview), node scripts/e2e-correcciones.mjs
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
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
  mateo: { role: 'alumno', personId: 'al2', name: 'Mateo Méndez Ortega' },
  regina: { role: 'alumno', personId: 'al1', name: 'Regina Méndez Ortega' },
  secundaria: { role: 'alumno', personId: 'al41', name: 'Alumno secundaria' },
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('edugrid.demo.db.v1')))
let v = 0
const openFolders = async () => { const closed = page.locator('main button[aria-expanded="false"]'); while (await closed.count()) await closed.first().click() }
const as = async (who, path, { reset = false } = {}) => {
  await page.goto(`${BASE}#/`)
  await page.evaluate(([s, r]) => { if (r) localStorage.clear(); localStorage.setItem('edugrid.demo.sesion', s) }, [JSON.stringify(S[who]), reset])
  await page.goto(`${BASE}?v=${++v}#${path}`)
  await page.waitForLoadState('networkidle')
}

// 1. Restablecer dos veces da exactamente los mismos datos (y los de la semilla del repositorio)
const seed = JSON.parse(readFileSync('src/data/seed.json', 'utf8'))
const pick = (d) => JSON.stringify({ groups: d.groups, students: d.students, teachers: d.teachers, gradeRecords: d.gradeRecords, attendance: d.attendance, announcements: d.announcements, charges: d.charges })
const resetFromLogin = async () => {
  await page.goto(`${BASE}#/`)
  await page.evaluate(() => localStorage.removeItem('edugrid.demo.sesion'))
  await page.goto(`${BASE}?v=${++v}#/demo`)
  await page.getByRole('button', { name: 'Restablecer datos demo' }).click()
  await page.getByRole('button', { name: 'Sí, restablecer' }).click()
  await page.waitForFunction(() => !!localStorage.getItem('edugrid.demo.db.v1'))
  return pick(await db())
}
await page.goto(`${BASE}#/`)
await page.evaluate(() => localStorage.clear())
const first = await resetFromLogin()
// Un cambio entre restablecimientos: al restablecer debe volver todo igual
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('edugrid.demo.db.v1')); d.gradeRecords[0].score = 1; localStorage.setItem('edugrid.demo.db.v1', JSON.stringify(d)) })
const second = await resetFromLogin()
if (first !== second) fail('Restablecer dos veces dio datos distintos')
if (first !== pick(seed)) fail('Los datos cargados no son los de la semilla')
const d0 = await db()

if (d0.groups.length !== 16 || d0.students.length !== 64) fail(`Se esperaban 16 grupos y 64 alumnos: ${d0.groups.length} / ${d0.students.length}`)
if (d0.groups.some((g) => g.id.includes('secundaria-2B'))) fail('Apareció un grupo que no existe en la semilla')
step('Restablecer dos veces da datos idénticos: 16 grupos, 64 alumnos, calificaciones fijas')

// 2. Un titular por grupo y ningún docente activo sin grupo
const titular = new Map()
for (const g of d0.groups) titular.set(g.homeroomTeacherId, (titular.get(g.homeroomTeacherId) ?? 0) + 1)
const active = d0.teachers.filter((t) => t.active)
if ([...titular.values()].some((n) => n > 1)) fail('Hay docentes titulares de más de un grupo')
const sinGrupo = active.filter((t) => !titular.has(t.id) && !d0.assignments.some((a) => a.teacherId === t.id))
if (sinGrupo.length) fail(`Docentes activos sin grupo: ${sinGrupo.map((t) => t.firstName).join(', ')}`)
await as('admin', '/admin/docentes')
const body = await page.locator('main').innerText()
if (!body.includes(String(active.length))) fail('La pantalla de docentes no muestra el número real')
if (/sin grupo/i.test(body)) fail('Sigue apareciendo un docente «sin grupo»')
step(`Cada uno de los ${active.length} docentes es titular de un solo grupo; ninguno queda sin grupo`)

// 3. Laura ve la feria de primaria y el mensaje de 2° A; no ve kinder ni secundaria
await as('familia', '/avisos')
const avisos = await page.locator('main').innerText()
for (const t of ['Feria de ciencias de primaria', 'Junta de Consejo Técnico']) if (!avisos.includes(t)) fail(`Laura no ve «${t}»`)
for (const t of ['Nuevo horario de entrada en kinder', 'Campaña de vacunación en secundaria']) if (avisos.includes(t)) fail(`Laura ve «${t}» y no le corresponde`)
await page.getByRole('tab', { name: /Mensajes de grupo/ }).click()
const mensajes = await page.locator('main').innerText()
if (!mensajes.includes('Recuerden que el viernes 27 no hay clases')) fail('Laura no ve el mensaje de 2° de primaria A')
if (!mensajes.includes('Material para la clase del miércoles')) fail('Laura no ve el mensaje de 4° de primaria A')
step('Laura ve la Feria de primaria y los mensajes de 2° A y 4° A; no ve avisos de kinder ni de secundaria')

// 4. Al confirmar lectura, el contador del menú y la campana bajan al momento
const unreadNav = async () => {
  const label = (await page.getByRole('navigation').first().getByRole('link', { name: /Avisos/ }).first().innerText()).replace(/\s+/g, ' ')
  return Number(label.match(/(\d+)/)?.[1] ?? 0)
}
const bell = async () => Number(((await page.getByRole('link', { name: /Notificaciones/ }).first().getAttribute('aria-label')) ?? '').match(/(\d+)/)?.[1] ?? 0)
await page.getByRole('tab', { name: /Avisos institucionales/ }).click()
const beforeNav = await unreadNav()
const beforeBell = await bell()
await page.getByRole('button', { name: 'Enterado, confirmo lectura' }).first().click()
await page.waitForTimeout(300)
const afterNav = await unreadNav()
const afterBell = await bell()
if (!(afterNav < beforeNav)) fail(`El contador del menú no bajó (${beforeNav} → ${afterNav})`)
if (beforeBell > 0 && !(afterBell < beforeBell)) fail(`La campana no bajó (${beforeBell} → ${afterBell})`)
step(`Al confirmar lectura el contador baja al momento (menú ${beforeNav} → ${afterNav}, campana ${beforeBell} → ${afterBell})`)

// 5. Los conteos de familias salen de los datos reales
await as('admin', '/avisos', { reset: true })
const d1 = seed
const familiesOf = (students) => new Set(students.map((s) => [...s.guardianIds].sort().join('+')))
const lvl = (s) => d1.grades.find((g) => g.id === d1.groups.find((x) => x.id === s.groupId).gradeId).level
const activeSt = d1.students.filter((s) => s.status === 'activo')
const expected = {
  'Junta de Consejo Técnico: no hay clases': familiesOf(activeSt).size,
  'Nuevo horario de entrada en kinder': familiesOf(activeSt.filter((s) => ['kinder', 'maternal'].includes(lvl(s)))).size,
  'Campaña de vacunación en secundaria': familiesOf(activeSt.filter((s) => lvl(s) === 'secundaria')).size,
}
for (const [title, n] of Object.entries(expected)) {
  const card = page.locator('article', { has: page.getByRole('heading', { name: title }) })
  const text = await card.innerText()
  const m = text.match(/Leído por (\d+) de (\d+) familias?/)
  if (!m) fail(`No aparece el conteo de «${title}»`)
  if (Number(m[2]) !== n) fail(`«${title}»: dice ${m[2]} familias y los datos tienen ${n}`)
  if (Number(m[1]) > n) fail(`«${title}»: más lecturas que familias`)
}
step(`Los conteos de familias cuadran con los datos (${Object.values(expected).join(', ')})`)

// 6. Carmen ve todas las clases del día de su grupo, señalando cuáles imparte ella
await as('docente', '/docente')
const card = page.getByRole('heading', { name: /Clases del martes/ }).locator('xpath=ancestor::*[.//li][1]')
const sched = d1.schedule.filter((s) => s.day === 2 && (s.teacherId === 't14' || s.groupId === 'gr-primaria-4A'))
const rows = await card.locator('li').count()
if (rows !== sched.length) fail(`«Clases del martes» muestra ${rows} de ${sched.length} clases`)
if (!(await card.innerText()).includes('las impartes tú')) fail('No se aclara cuáles clases imparte ella')
step(`«Clases del martes» muestra las ${sched.length} clases de 4° A y aclara cuáles imparte Carmen`)

// 7. La entrada con QR de Regina (07:42) ya cuenta como asistencia en todas las vistas
await page.goto(`${BASE}?v=${++v}#/docente/asistencia?grupo=gr-primaria-4A`)
await page.waitForLoadState('networkidle')
const att = await page.locator('main').innerText()
if (!att.includes('Entró 07:42 con QR')) fail('El pase de lista no muestra la entrada de Regina')
if (!/por su entrada con QR/.test(att)) fail('El pase de lista no dice que la asistencia vino del QR')
if ((await page.getByRole('radio', { name: 'Asistió' }).first().getAttribute('aria-checked')) !== 'true') fail('Regina no aparece como presente')
await as('familia', '/familia')
await openFolders()
const home = await page.locator('main').innerText()
if (!/Asistencia de hoy[\s\S]{0,80}Asistió/.test(home)) fail('El inicio de Laura no muestra la asistencia de hoy')
if (!home.includes('Entrada registrada · 07:42')) fail('El inicio de Laura no muestra la entrada de las 07:42')
step('La entrada de Regina a las 07:42 aparece como «Asistió» en el pase de lista y en el inicio de Laura')

// 7b. Una entrada nueva con QR marca la asistencia automáticamente
await as('admin', '/admin/entradas')
const d2 = seed
const other = d2.students.find((s) => s.groupId === 'gr-primaria-1A' && s.status === 'activo')
await page.getByLabel('O escribe el código de la credencial').fill(other.qrCode)
await page.getByRole('button', { name: 'Registrar', exact: true }).click()
await page.waitForTimeout(400)
const rec = (await db()).attendance.find((a) => a.studentId === other.id && a.date === '2026-11-24')
if (!rec || rec.source !== 'qr') fail('Escanear una entrada no marcó la asistencia')
step(`Escanear la entrada de ${other.firstName} marcó su asistencia (${rec.status})`)

// 8. El promedio de Mateo es 7.9 en Papá, Alumno y Admin
await as('familia', '/familia', { reset: true })
await openFolders()
const avgFam = (await page.locator('article', { hasText: 'Mateo' }).first().innerText()).match(/([\d.]+)\s*Promedio\b/)?.[1]
await as('mateo', '/alumno/calificaciones')
const avgAlu = (await page.getByRole('table', { name: /Calificaciones/ }).locator('tfoot').innerText()).match(/Promedio\s*([\d.]+)/)?.[1]
await as('admin', '/alumnos/al2')
const grades = page.getByRole('table', { name: /Calificaciones/ })
const avgAdm = (await grades.locator('tfoot').innerText()).match(/Promedio\s*([\d.]+)/)?.[1]
if (![avgFam, avgAlu, avgAdm].every((x) => x === '7.9')) fail(`Promedio de Mateo: familia ${avgFam}, alumno ${avgAlu}, admin ${avgAdm}`)
step('El promedio de Mateo es 7.9 en Papá, Alumno y Admin')

// 9. La boleta en PDF se descarga para Regina y Mateo
for (const [who, path, name] of [['familia', '/familia/hijo/al1?vista=calificaciones', 'Regina'], ['familia', '/familia/hijo/al2?vista=calificaciones', 'Mateo']]) {
  await as(who, path)
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar boleta (PDF)' }).click()])
  const file = `${OUT}/${dl.suggestedFilename()}`
  await dl.saveAs(file)
  const head = readFileSync(file).subarray(0, 5).toString()
  if (head !== '%PDF-' || !dl.suggestedFilename().includes('DEMO')) fail(`La boleta de ${name} no es un PDF de demo`)
}
step('La boleta en PDF de Regina y de Mateo se descarga (archivo marcado DEMO)')

// 10. El menú de dirección tiene Calificaciones y Calendario
await as('admin', '/admin/calendario')
await page.getByRole('heading', { level: 1, name: 'Calendario' }).waitFor()
if (!(await page.locator('main').innerText()).includes('Feria de ciencias')) fail('El calendario de dirección no muestra los eventos')
for (const label of ['Calificaciones', 'Calendario']) if (!(await page.getByRole('link', { name: label, exact: true }).count())) fail(`Falta «${label}» en el menú de dirección`)
await page.getByRole('link', { name: 'Calificaciones', exact: true }).first().click()
await page.getByRole('heading', { level: 1 }).waitFor()
await page.screenshot({ path: `${OUT}/admin-calificaciones.png` })
step('Dirección tiene «Calificaciones» y «Calendario» en el menú')

// 11. Al inscribir a un hermano, el tutor se busca por apellidos o nombre (sin acentos)
await as('admin', '/admin/alumnos?alta=1')
await page.getByLabel('Ya está registrado (hermanos)').check()
await page.getByLabel('Buscar tutor registrado').fill('ortega salinas')
await page.getByRole('button', { name: /Ortega Salinas, Laura/ }).waitFor()
await page.getByLabel('Buscar tutor registrado').fill('mateo')
await page.getByRole('button', { name: /Ortega Salinas, Laura/ }).click()
await page.getByText('Hermanos: Regina').waitFor()
await page.screenshot({ path: `${OUT}/alta-hermano-buscador.png` })
step('Al inscribir a un hermano se busca al tutor por apellidos, nombre o nombre de un hijo y se vincula')

// 12. En el celular, dirección tiene «Configuración» en lugar de «Más», con una tarjeta por sección
await page.setViewportSize({ width: 390, height: 844 })
await as('admin', '/admin')
const bottom = page.getByRole('navigation', { name: 'Navegación principal' }).last()
if (await bottom.getByRole('button', { name: 'Más' }).count()) fail('Dirección sigue viendo «Más» en el celular')
await bottom.getByRole('link', { name: 'Configuración' }).click()
await page.getByRole('heading', { level: 1, name: 'Configuración' }).waitFor()
const tiles = ['Familias', 'Docentes', 'Calificaciones', 'Calendario', 'Clases', 'Aulas', 'Ciclos y grupos', 'Pagos', 'Facturación', 'Permisos', 'Bitácora', 'Privacidad']
for (const t of tiles) if (!(await page.locator('main').getByRole('link', { name: new RegExp(`^${t}`) }).count())) fail(`Falta la tarjeta «${t}» en Configuración`)
await page.screenshot({ path: `${OUT}/admin-configuracion-celular.png`, fullPage: true })
await page.locator('main').getByRole('link', { name: /^Aulas/ }).click()
await page.waitForURL(/admin\/aulas/)
await page.getByRole('heading', { level: 1 }).waitFor()
if ((await bottom.getByRole('link', { name: 'Configuración' }).getAttribute('aria-current')) !== 'page') fail('«Configuración» no queda marcada al entrar a una sección')
await page.setViewportSize({ width: 1280, height: 900 })
step('En el celular, «Configuración» reemplaza a «Más» y muestra las tarjetas de cada sección')

// 13. Docente, familia y alumno: «Más» abre una pantalla con tarjetas
const HUBS = {
  docente: ['Asistencia', 'Calificaciones', 'Avisos', 'Tareas', 'Horario', 'Privacidad'],
  familia: ['Calendario', 'Pagos', 'Mis tarjetas', 'Privacidad'],
  regina: ['Mi credencial', 'Avisos', 'Privacidad'],
}
await page.setViewportSize({ width: 390, height: 844 })
for (const [who, cards] of Object.entries(HUBS)) {
  await as(who, '/')
  const nav = page.getByRole('navigation', { name: 'Navegación principal' }).last()
  await nav.getByRole('link', { name: /^Más/ }).click()
  await page.getByRole('heading', { level: 1, name: 'Más opciones' }).waitFor()
  for (const t of cards) if (!(await page.locator('main').getByRole('link', { name: new RegExp(`^${t}`) }).count())) fail(`${who}: falta la tarjeta «${t}»`)
  await page.screenshot({ path: `${OUT}/mas-${who}.png`, fullPage: true })
  await page.locator('main').getByRole('link', { name: new RegExp(`^${cards[0]}`) }).click()
  await page.waitForURL((u) => !u.hash.includes('/mas'))
  await page.getByRole('heading', { level: 1 }).waitFor()
  if ((await nav.getByRole('link', { name: /^Más/ }).getAttribute('aria-current')) !== 'page') fail(`${who}: «Más» no queda marcada al entrar a una sección`)
}
await page.setViewportSize({ width: 1280, height: 900 })
step('Docente, familia y alumno: «Más» abre tarjetas pastel con sus secciones')

// 14. Los indicadores del tablero son interactivos: llevan a su detalle, abren su listado o muestran avance
await as('docente', '/docente')
const tile = (name) => page.locator('main').getByRole('button', { name: new RegExp(`^${name}`) }).or(page.locator('main').getByRole('link', { name: new RegExp(`^${name}`) })).first()
await tile('Mis grupos').click()
await page.getByRole('dialog', { name: 'Mis grupos' }).getByRole('link', { name: /4° de primaria A/ }).waitFor()
await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click()
await tile('Alumnos').click()
if ((await page.getByRole('dialog', { name: 'Alumnos' }).getByRole('link').count()) < 4) fail('«Alumnos» no lista a los alumnos de la docente')
await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click()
if (!(await page.locator('main').getByRole('progressbar', { name: /Listas de hoy/ }).count())) fail('«Listas de hoy» no muestra barra de avance')
await tile('Calificaciones abiertas').click()
await page.waitForURL(/docente\/calificaciones/)
await as('admin', '/admin')
await tile('Cobrado este mes').click()
await page.waitForURL(/pagos\?vista=cargos/)
await as('admin', '/pagos')
await tile('Adeudo vencido').click()
await page.getByRole('dialog', { name: 'Adeudo vencido' }).getByRole('link').first().click()
await page.waitForURL(/pagos\/estado\//)
await as('familia', '/familia')
await openFolders()
await page.locator('main').getByRole('link', { name: /%\s*Asistencia/ }).first().click()
await page.waitForURL(/vista=asistencia/)
await page.getByRole('tab', { name: 'Asistencia', selected: true }).waitFor()
await as('secundaria', '/alumno')
await tile('Faltas').click()
await page.getByRole('dialog', { name: 'Faltas' }).waitFor()
await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click()
await tile('Promedio 1er trimestre').click()
await page.waitForURL(/alumno\/calificaciones/)
step('Los indicadores del tablero llevan a su detalle, abren su listado o muestran una barra de avance')

// 15. Inicio de la familia: cada hijo es un expediente contraído que se abre al tocarlo
await as('familia', '/familia', { reset: true })
const folders = page.locator('main').getByRole('button', { name: /Abrir expediente/ })
if ((await folders.count()) !== 2) fail(`Se esperaban 2 expedientes contraídos y hay ${await folders.count()}`)
const closedText = await page.locator('main ul[aria-label="Expedientes de tus hijos"]').innerText()
if (!closedText.includes('Regina Méndez Ortega') || !closedText.includes('4° de primaria A') || !closedText.includes('Primaria')) fail('El expediente contraído no muestra nombre y nivel')
if (closedText.includes('Asistencia de hoy') || closedText.includes('Saldo')) fail('El expediente contraído muestra datos de más')
await page.screenshot({ path: `${OUT}/familia-expedientes-cerrados.png`, fullPage: true })
await folders.first().click()
await page.getByRole('button', { name: /Contraer expediente/ }).waitFor()
const opened = await page.locator('main ul[aria-label="Expedientes de tus hijos"]').innerText()
if (!opened.includes('Asistencia de hoy') || !opened.includes('Ver expediente de Regina') || !opened.includes('Última observación docente')) fail('Al abrir el expediente no aparecen sus datos')
await page.screenshot({ path: `${OUT}/familia-expediente-abierto.png`, fullPage: true })
step('Familia: cada hijo es un expediente contraído (nombre, foto y nivel) que se abre con sus datos')

// 16. Calendario: tira de la semana con hoy marcado; al elegir otro día muestra lo de ese día
await as('familia', '/familia/calendario')
const week = page.getByRole('group', { name: 'Días de la semana' })
if ((await week.getByRole('button').count()) !== 7) fail('La tira de la semana no tiene 7 días')
if ((await week.getByRole('button', { name: /hoy/ }).getAttribute('aria-pressed')) !== 'true') fail('Hoy no aparece seleccionado')
await week.getByRole('button', { name: /Viernes.*27/ }).click()
await page.getByRole('region', { name: 'Agenda de la semana' }).getByText('Junta de Consejo Técnico (sin clases)').waitFor()
await page.getByRole('button', { name: 'Semana siguiente' }).click()
await page.getByRole('button', { name: 'Hoy', exact: true }).click()
if ((await week.getByRole('button', { name: /hoy/ }).getAttribute('aria-pressed')) !== 'true') fail('«Hoy» no regresa al día actual')
if (!(await page.locator('header').filter({ has: page.getByRole('heading', { level: 1 }) }).locator('svg').count())) fail('El encabezado no tiene ilustración')
step('Calendario: tira de la semana con hoy marcado y eventos del día elegido; encabezado ilustrado')

// 17. Al cambiar de página o regresar con «atrás» la vista empieza arriba (celular)
await page.setViewportSize({ width: 390, height: 700 })
await as('admin', '/admin/alumnos')
await page.mouse.wheel(0, 2500)
await page.waitForTimeout(300)
if ((await page.evaluate(() => window.scrollY)) < 200) fail('No se pudo desplazar la lista de alumnos para la prueba')
await page.locator('main').getByRole('link', { name: /Regina Méndez Ortega/ }).first().click()
await page.waitForURL(/alumnos\/al1/)
await page.waitForTimeout(200)
if ((await page.evaluate(() => window.scrollY)) > 5) fail('Al abrir otra página no empezó arriba')
await page.mouse.wheel(0, 1500)
await page.waitForTimeout(400)
await page.goBack()
await page.waitForURL(/admin\/alumnos/)
await page.waitForTimeout(300)
const backY = await page.evaluate(() => window.scrollY)
if (backY > 5) fail(`Al regresar con «atrás» no empezó arriba (quedó en ${backY}px)`)
await page.setViewportSize({ width: 1280, height: 900 })
step('Al cambiar de página o regresar con «atrás» la vista empieza arriba')

// 18. Mi perfil: desde la barra lateral (escritorio) y desde «Más» (celular), con foto y datos de contacto
await as('familia', '/familia', { reset: true })
await page.locator('aside').getByRole('link', { name: /Editar mi perfil/ }).click()
await page.waitForURL(/#\/perfil$/)
await page.getByRole('heading', { level: 1, name: 'Mi perfil' }).waitFor()
await page.getByLabel('Teléfono celular').fill('55 12')
await page.getByRole('button', { name: 'Guardar cambios' }).click()
await page.getByText('Escribe un teléfono de 10 dígitos.').waitFor()
await page.getByLabel('Correo electrónico').fill('laura.demo@ejemplo.mx')
await page.getByLabel('Teléfono celular').fill('55-1234-5678')
await page.getByRole('button', { name: 'Guardar cambios' }).click()
await page.getByText('Cambios guardados').waitFor()
const tutor = (await db()).guardians.find((g) => g.id === 'tu0')
if (tutor.email !== 'laura.demo@ejemplo.mx' || tutor.phone !== '5512345678') fail('Los datos de contacto no se guardaron')
const png = Buffer.from(await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#1769d2'; x.fillRect(0, 0, 200, 200); return c.toDataURL('image/png').split(',')[1] }), 'base64')
// Tocar el botón debe abrir el selector de archivos del sistema (no basta con poner el archivo por código)
const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), page.getByText('Agregar foto de perfil', { exact: true }).click()])
await chooser.setFiles({ name: 'perfil.png', mimeType: 'image/png', buffer: png })
await page.getByText('Cambiar foto de perfil', { exact: true }).waitFor()
if (!(await page.locator('aside img').count())) fail('La foto de perfil no aparece en la barra lateral')
await page.setViewportSize({ width: 390, height: 800 })
await as('regina', '/mas')
await page.locator('main').getByRole('link', { name: /Perfil/ }).click()
await page.waitForURL(/#\/perfil$/)
await page.getByText('Foto institucional', { exact: true }).waitFor()
const [chooser2] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), page.getByText('Agregar foto de perfil', { exact: true }).click()])
await chooser2.setFiles({ name: 'perfil.png', mimeType: 'image/png', buffer: png })
await page.getByText('Cambiar foto de perfil', { exact: true }).waitFor()
const reg = (await db()).students.find((x) => x.id === 'al1')
if (!reg.profilePhoto?.startsWith('data:image/jpeg') || reg.photo !== seed.students.find((x) => x.id === 'al1').photo) fail('La foto de perfil del alumno tocó la institucional')
await page.setViewportSize({ width: 1280, height: 900 })
step('Mi perfil: se abre desde la barra lateral y desde «Más», guarda foto, correo y teléfono; la foto institucional no cambia')

// 19. Dirección elige el color de las tarjetas y del menú de abajo para toda la escuela
await page.setViewportSize({ width: 390, height: 844 })
await as('familia', '/avisos', { reset: true })
const barBg = () => page.getByRole('navigation', { name: 'Navegación principal' }).last().locator('ul').evaluate((e) => getComputedStyle(e).backgroundColor)
const before = await barBg()
if (/0\.95|255, 255, 255/.test(before)) fail('El menú de abajo no toma el color de las tarjetas')
await as('admin', '/admin/configuracion')
await page.getByRole('radiogroup', { name: 'Fondo de las tarjetas' }).getByRole('radio', { name: 'Verde' }).click()
await page.getByText('Guardado: Tarjetas: Verde').waitFor()
await page.getByRole('radiogroup', { name: 'Fondo del menú de abajo' }).getByRole('radio', { name: /Sin color/ }).click()
await page.getByText('Guardado: Menú: sin color').waitFor()
const look = (await db()).meta.appearance
if (look.cards !== 'verde' || look.menu !== 'blanco') fail('No se guardaron los colores de tarjetas y menú')
await as('familia', '/avisos')
const after = await barBg()
if (after === before || !/0\.95|255, 255, 255/.test(after)) fail(`El menú de abajo no quedó en blanco (${after})`)
await page.setViewportSize({ width: 1280, height: 900 })
step('Dirección elige el color de tarjetas y del menú de abajo; el menú toma el color de las tarjetas por omisión')

if (errors.length) fail(`Errores en la página: ${errors.join(' | ')}`)
await browser.close()
console.log('Correcciones del mensaje 8: todo en orden.')
