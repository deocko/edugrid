// Inicio de sesión real y alta de escuelas (Mensaje 10), de punta a punta en el navegador:
// wizard de 4 pasos, contraseña incorrecta, cerrar sesión, recuperar contraseña, plantilla e
// importación de Excel con errores por fila, invitación de un docente, un tutor con dos hijos y
// una sola cuenta, aislamiento entre escuelas, prueba de 30 días vencida y el botón «Ver demo».
// Uso: npm run build:servidor && EDUGRID_SIMULAR_PRUEBA=si npm run servidor  y luego  node scripts/e2e-login.mjs
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const XLSX = require('xlsx')
const BASE = process.env.QA_URL ?? 'http://localhost:3000/'

const step = (m) => console.log(`✓ ${m}`)
const fail = (m) => { throw new Error(m) }
const sufijo = Date.now().toString(36)
const ADMIN = { nombre: 'Mtra. Elena Prueba (DEMO)', correo: `direccion.${sufijo}@demo.edugrid.mx`, contrasena: 'Escuela-Faro-2026' }

const browser = await chromium.launch()
const errors = []
const nuevaPagina = async (viewport = { width: 390, height: 844 }) => {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  return page
}
const api = async (ruta, cuerpo, token) => {
  const headers = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  const r = await fetch(new URL(`api/${ruta}`, BASE), cuerpo ? { method: 'POST', headers, body: JSON.stringify(cuerpo) } : { headers })
  return { status: r.status, body: await r.json() }
}
const sesionDe = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('edugrid.sesion') ?? 'null'))
const abrirLiga = async (page, liga) => {
  await page.goto(`${BASE}#${liga.split('#')[1]}`)
  await page.waitForLoadState('networkidle')
}

// 1. Pantalla de inicio: login real, «Registrar mi escuela» y «Ver demo»
const p = await nuevaPagina()
await p.goto(`${BASE}#/`)
await p.getByRole('heading', { name: 'Inicia sesión' }).waitFor()
if (await p.getByRole('button', { name: /Entrar como/ }).count()) fail('El inicio de sesión todavía muestra «Entrar como»')
await p.getByRole('link', { name: 'Ver demo' }).waitFor()
step('La pantalla de inicio pide correo y contraseña; el demo queda aparte en «Ver demo»')

// 2. Wizard de 4 pasos
await p.getByRole('link', { name: 'Registrar mi escuela' }).click()
await p.getByText('Paso 1 de 4 · Escuela').waitFor()
await p.getByRole('button', { name: 'Siguiente' }).click()
await p.getByText('Escribe el nombre de la escuela.').waitFor()
await p.getByLabel('Nombre de la escuela').fill(`Colegio Faro ${sufijo} (DEMO)`)
await p.getByLabel('Primaria').check()
await p.getByLabel('Secundaria').check()
await p.getByLabel('Correo de contacto de la escuela').fill(`contacto.${sufijo}@demo.edugrid.mx`)
await p.getByRole('button', { name: 'Siguiente' }).click()
await p.getByText('Paso 2 de 4 · Administrador').waitFor()
await p.getByLabel('Tu nombre').fill(ADMIN.nombre)
await p.getByLabel('Tu correo').fill(ADMIN.correo)
await p.getByLabel('Contraseña', { exact: true }).fill(ADMIN.contrasena)
await p.getByLabel('Confirma la contraseña').fill('otra-distinta')
await p.getByRole('button', { name: 'Siguiente' }).click()
await p.getByText('Las contraseñas no coinciden.').waitFor()
await p.getByLabel('Confirma la contraseña').fill(ADMIN.contrasena)
await p.getByRole('button', { name: 'Siguiente' }).click()
await p.getByText('Paso 3 de 4 · Cargar datos').waitFor()
await p.getByRole('button', { name: 'Lo hago después' }).click()
await p.getByText('Paso 4 de 4 · Resumen').waitFor()
await p.getByText('Lo hago después').first().waitFor()
await p.getByRole('button', { name: 'Crear mi escuela' }).click()
await p.waitForURL(/#\/admin$/)
await p.locator('[data-banner-prueba]').getByText('te quedan 30 días').waitFor()
if (await p.locator('[data-franja-demo]').count()) fail('Una escuela real no debe mostrar la franja DEMO')
const sesA = await sesionDe(p)
if (sesA?.perfil?.tipo !== 'administrador' || sesA.escuela.diasRestantes !== 30) fail('La sesión del administrador no quedó bien')
if (JSON.stringify(sesA).includes(ADMIN.contrasena)) fail('La contraseña quedó guardada en el navegador')
step('El wizard crea la escuela y el administrador y entra al tablero con 30 días de prueba')

// 3. Cerrar sesión, contraseña incorrecta y entrar con correo y contraseña
await p.getByRole('button', { name: 'Cerrar sesión' }).click()
await p.getByRole('heading', { name: 'Inicia sesión' }).waitFor()
await p.getByLabel('Correo electrónico').fill(ADMIN.correo)
await p.getByLabel('Contraseña').fill('no-es-esta')
await p.getByRole('button', { name: 'Entrar' }).click()
await p.getByRole('alert').getByText('El correo o la contraseña no son correctos.').waitFor()
if (!/#\/$/.test(p.url())) fail('Con contraseña incorrecta no debe entrar')
await p.getByLabel('Contraseña').fill(ADMIN.contrasena)
await p.getByRole('button', { name: 'Entrar' }).click()
await p.waitForURL(/#\/admin$/)
step('Contraseña incorrecta no entra; cerrar sesión vuelve al login; la correcta entra')

// 4. Recuperar contraseña: la liga aparece en pantalla (modo demo) y sirve una sola vez
await p.getByRole('button', { name: 'Cerrar sesión' }).click()
await p.getByRole('button', { name: 'Olvidé mi contraseña' }).click()
await p.getByLabel('Correo electrónico').fill(ADMIN.correo)
await p.getByRole('button', { name: 'Enviar liga' }).click()
const ligaRec = await p.locator('[data-liga-demo] a').first().textContent()
if (!ligaRec?.includes('/restablecer/')) fail('No apareció la liga para crear una contraseña nueva')
await abrirLiga(p, ligaRec)
ADMIN.contrasena = 'Nueva-Faro-2026!'
await p.getByLabel('Contraseña nueva').fill(ADMIN.contrasena)
await p.getByLabel('Confirma la contraseña').fill(ADMIN.contrasena)
await p.getByRole('button', { name: 'Guardar y entrar' }).click()
await p.waitForURL(/#\/admin$/)
if ((await api('cuenta/iniciar', { correo: ADMIN.correo, contrasena: 'Escuela-Faro-2026' })).status !== 401) fail('La contraseña vieja sigue sirviendo')
step('Recuperar contraseña genera su liga y la contraseña nueva reemplaza a la anterior')

// 5. Plantilla de Alumnos → 5 filas (una con correo inválido) → vista previa → importar 4
await p.goto(`${BASE}#/admin/alumnos`)
const [descarga] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Descargar plantilla' }).click()])
if (descarga.suggestedFilename() !== 'plantilla-alumnos-edugrid.xlsx') fail(`Nombre de plantilla inesperado: ${descarga.suggestedFilename()}`)
const libro = XLSX.read(Buffer.concat(await (async () => { const t = []; for await (const c of await descarga.createReadStream()) t.push(c); return t })()))
const hoja = XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]], { header: 1 })
if (!String(hoja[0][0]).includes('*') || !String(hoja[1][0]).startsWith('EJEMPLO') || !String(hoja[2][0]).startsWith('EJEMPLO')) fail('La plantilla no trae columnas obligatorias marcadas y 2 filas de ejemplo')
if (!libro.SheetNames.includes('Instrucciones')) fail('La plantilla no trae la hoja de instrucciones')
const titulos = hoja[0]
const tutora = `marta.${sufijo}@demo.edugrid.mx`
const fila = (o) => titulos.map((t) => o[String(t).replace(' *', '')] ?? '')
const filas = [
  fila({ 'Nombre(s)': 'Hugo', Apellidos: 'Ríos Luna (DEMO)', 'Fecha de nacimiento': '2016-05-10', Nivel: 'Primaria', Grado: 4, Grupo: 'A', 'Nombre del tutor': 'Marta', 'Apellidos del tutor': 'Luna Paz (DEMO)', Parentesco: 'Madre', 'Correo del tutor': tutora }),
  fila({ 'Nombre(s)': 'Iris', Apellidos: 'Ríos Luna (DEMO)', 'Fecha de nacimiento': '14/02/2018', Nivel: 'Primaria', Grado: 2, Grupo: 'B', 'Nombre del tutor': 'Marta', 'Apellidos del tutor': 'Luna Paz (DEMO)', Parentesco: 'Madre', 'Correo del tutor': tutora }),
  fila({ 'Nombre(s)': 'Leo', Apellidos: 'Mora Gil (DEMO)', 'Fecha de nacimiento': '2013-01-20', Nivel: 'Secundaria', Grado: 1, Grupo: 'A', 'Correo del alumno': 'correo-invalido' }),
  fila({ 'Nombre(s)': 'Ana', Apellidos: 'Sol Rey (DEMO)', 'Fecha de nacimiento': '2014-07-03', Nivel: 'Primaria', Grado: 6, Grupo: 'A' }),
  fila({ 'Nombre(s)': 'Tomás', Apellidos: 'Vega Ruiz (DEMO)', 'Fecha de nacimiento': '2012-11-11', Nivel: 'Secundaria', Grado: 2, Grupo: 'A', 'Correo del alumno': `tomas.${sufijo}@demo.edugrid.mx` }),
]
const lleno = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(lleno, XLSX.utils.aoa_to_sheet([titulos, hoja[1], hoja[2], ...filas]), 'Alumnos')
const archivo = XLSX.write(lleno, { type: 'buffer', bookType: 'xlsx' })
const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.getByText('Importar Excel', { exact: true }).click()])
await chooser.setFiles({ name: 'alumnos.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: archivo })
const dlg = p.getByRole('dialog')
await dlg.getByText('4 filas listas para importar').waitFor()
await dlg.locator('[data-fila="6"][data-estado="error"]').getByText('El correo «correo-invalido» no tiene un formato válido.').waitFor()
if ((await dlg.locator('[data-estado="ejemplo"]').count()) !== 2) fail('Las 2 filas de ejemplo no se marcaron como ejemplo')
await dlg.locator('[data-fila="7"]').getByText('Sin correo: invítalo después.').waitFor()
const importar = dlg.getByRole('button', { name: 'Importar 4 filas válidas' })
if (await importar.isEnabled()) fail('Debe pedir el consentimiento antes de importar alumnos')
await dlg.getByLabel(/consentimiento/).check()
await importar.click()
const rep = dlg.locator('[data-reporte-importacion]')
await rep.getByText('Entraron 4 alumnos. Se rechazó 1 fila.').waitFor()
await rep.getByText(/Fila 6 \(Leo Mora Gil \(DEMO\)\): El correo «correo-invalido» no tiene un formato válido\./).waitFor()
const ligaTutora = await rep.locator(`[data-liga-invitacion="${tutora}"]`).first().getAttribute('href')
if (!ligaTutora) fail('No se generó la invitación de la tutora')
await dlg.getByRole('button', { name: 'Listo' }).click()
const datosA = (await api('datos', undefined, (await sesionDe(p)).token)).body
if (datosA.students.length !== 4) fail(`Se esperaban 4 alumnos en la base, hay ${datosA.students.length}`)
const hermanos = datosA.students.filter((s) => s.lastName === 'Ríos Luna (DEMO)')
if (hermanos.length !== 2 || hermanos[0].guardianIds[0] !== hermanos[1].guardianIds[0]) fail('Los dos hermanos no quedaron con la misma tutora')
step('Plantilla de Alumnos con 5 filas: la vista previa marca el correo inválido, entran 4 y se reporta 1 rechazada con su motivo')

// 6. Alta de un docente con correo → invitación → crea su contraseña y entra solo como docente
await p.goto(`${BASE}#/admin/docentes`)
await p.getByRole('button', { name: 'Registrar docente' }).click()
const fd = p.getByRole('dialog')
const correoDocente = `carmen.${sufijo}@demo.edugrid.mx`
await fd.getByLabel('Nombre(s)').fill('Carmen')
await fd.getByLabel('Apellidos').fill('Salinas Ruiz (DEMO)')
await fd.getByLabel('Especialidad').fill('Titular de primaria')
await fd.getByLabel('Correo').fill(correoDocente)
await fd.getByRole('button', { name: 'Guardar' }).click()
const ligaDocente = await p.locator(`[data-liga-invitacion="${correoDocente}"]`).getAttribute('href')
if (!ligaDocente) fail('No apareció la liga de invitación del docente')
const d = await nuevaPagina()
await d.goto(`${BASE}${ligaDocente}`)
await d.getByRole('heading', { name: /Te invitan a Colegio Faro/ }).waitFor()
await d.getByText('perfil de docente', { exact: false }).waitFor()
await d.getByLabel('Crea tu contraseña').fill('Docente-Faro-1')
await d.getByLabel('Confirma tu contraseña').fill('Docente-Faro-1')
await d.getByRole('button', { name: 'Crear contraseña y entrar' }).click()
await d.waitForURL(/#\/docente$/)
const sesD = await sesionDe(d)
if (sesD.perfiles.length !== 1 || sesD.perfil.tipo !== 'docente' || sesD.escuela.id !== sesA.escuela.id) fail('El docente debe entrar solo con su perfil de docente en esa escuela')
await d.goto(`${BASE}#/admin`)
await d.getByText('No tienes acceso a esta información').waitFor()
step('El alta de un docente con correo genera su invitación; con la liga crea su contraseña y entra solo como docente')

// 7. La tutora de los dos hermanos entra con UNA cuenta y ve a sus dos hijos
const t = await nuevaPagina()
await t.goto(`${BASE}${ligaTutora}`)
await t.getByLabel('Crea tu contraseña').fill('Familia-Faro-1')
await t.getByLabel('Confirma tu contraseña').fill('Familia-Faro-1')
await t.getByRole('button', { name: 'Crear contraseña y entrar' }).click()
await t.waitForURL(/#\/familia$/)
await t.getByText('Hugo', { exact: false }).first().waitFor()
await t.getByText('Iris', { exact: false }).first().waitFor()
const sesT = await sesionDe(t)
if (sesT.perfil.tipo !== 'familia') fail('La tutora debe entrar como familia')
// Cerrar y volver a entrar: una sola cuenta con sus perfiles (familia y cada hijo)
await t.getByRole('button', { name: 'Cerrar sesión' }).click()
await t.getByLabel('Correo electrónico').fill(tutora)
await t.getByLabel('Contraseña').fill('Familia-Faro-1')
await t.getByRole('button', { name: 'Entrar' }).click()
await t.getByRole('button', { name: /Entrar como Familia/ }).click()
await t.waitForURL(/#\/familia$/)
await t.getByText('Iris', { exact: false }).first().waitFor()
step('Una tutora con dos hijos importados los ve a los dos con UNA sola cuenta')

// 8. Dos escuelas en la base: B no ve nada de A
const regB = await api('cuenta/registro', { escuela: { nombre: `Instituto Brisa ${sufijo} (DEMO)`, niveles: ['primaria'], correoContacto: `brisa.${sufijo}@demo.edugrid.mx` }, admin: { nombre: 'Dirección Brisa (DEMO)', correo: `dir.brisa.${sufijo}@demo.edugrid.mx`, contrasena: 'Brisa-2026-ok' } })
if (regB.status !== 201) fail('No se pudo crear la escuela B')
const datosB = (await api('datos', undefined, regB.body.token)).body
if (datosB.students.length !== 0 || datosB.teachers.length !== 0 || datosB.meta.school.name.includes('Faro')) fail('La escuela B ve datos de la escuela A')
const b = await nuevaPagina({ width: 1280, height: 900 })
await b.goto(`${BASE}#/`)
await b.getByLabel('Correo electrónico').fill(`dir.brisa.${sufijo}@demo.edugrid.mx`)
await b.getByLabel('Contraseña').fill('Brisa-2026-ok')
await b.getByRole('button', { name: 'Entrar' }).click()
await b.waitForURL(/#\/admin$/)
await b.goto(`${BASE}#/admin/alumnos`)
await b.getByRole('heading', { name: 'Alumnos' }).waitFor()
if (await b.getByText('Ríos Luna').count()) fail('El administrador de B ve alumnos de A')
const intento = await api('datos', { op: 'update', tabla: 'students', id: hermanos[0].id, cambios: { firstName: 'Intruso' } }, regB.body.token)
if (intento.status !== 404) fail('B pudo tocar un alumno de A')
step('Un usuario de la escuela B no ve ni modifica los datos de la escuela A')

// 9. Prueba vencida (simulada en desarrollo): pantalla «Tu prueba terminó»
await p.goto(`${BASE}#/admin`)
await p.getByRole('button', { name: 'Solo pruebas: terminar la prueba' }).click()
await p.getByRole('heading', { name: 'Tu prueba terminó' }).waitFor()
await p.getByRole('link', { name: 'Contactar para contratar' }).waitFor()
await p.reload()
await p.getByRole('heading', { name: 'Tu prueba terminó' }).waitFor()
if ((await api('datos', undefined, (await sesionDe(p)).token)).status !== 402) fail('Con la prueba vencida la API no debe entregar datos')
await p.getByRole('button', { name: 'Solo pruebas: volver a 30 días' }).click()
await p.locator('[data-banner-prueba]').getByText('te quedan 30 días').waitFor()
step('Con la prueba vencida aparece «Tu prueba terminó» con el botón de contacto (y la API no entrega datos)')

// 10. «Ver demo» sigue entrando al Colegio Demo, marcado DEMO en toda la pantalla
const demo = await nuevaPagina()
await demo.goto(`${BASE}#/`)
await demo.getByRole('link', { name: 'Ver demo' }).click()
await demo.getByRole('button', { name: 'Entrar como Administrador' }).click()
await demo.waitForURL(/#\/admin$/)
await demo.locator('[data-franja-demo]').getByText('DEMO · Colegio Demo EDUGRID').waitFor()
const datosDemo = (await api('datos')).body
if (datosDemo.meta.school.name !== 'Colegio Demo EDUGRID' || datosDemo.students.length < 60) fail('El Colegio Demo cambió')
await demo.getByRole('button', { name: 'Salir de la cuenta demo' }).click()
await demo.getByRole('heading', { name: 'Inicia sesión' }).waitFor()
step('«Ver demo» entra al Colegio Demo y lo marca DEMO en toda la pantalla')

if (errors.length) fail(`Errores en la página: ${errors.join(' | ')}`)
await browser.close()
console.log('Inicio de sesión y alta de escuelas: todo en orden.')
