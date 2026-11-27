// Correcciones del Mensaje 11, de punta a punta en el navegador:
// escuela solo de Primaria (tablero, «Alumnos por nivel» y Ciclos y grupos), aviso antes de
// crear un grupo al importar, una invitación por correo (alumnos + familias), estado
// Pendiente → Aceptada, docente con materia, textos por rol y estados vacíos, Titular y Salón,
// correos sin cortes en la vista previa, Exportar en los 5 módulos y aislamiento entre escuelas.
// Uso: npm run build:servidor && EDUGRID_SIMULAR_PRUEBA=si EDUGRID_BUZON=qa-output/buzon.jsonl npm run servidor
//      y luego  node scripts/e2e-mensaje-11.mjs   (QA_URL=<url> para otra dirección)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const XLSX = require('xlsx')
const BASE = process.env.QA_URL ?? 'http://localhost:3000/'
const SALIDA = process.env.QA_SALIDA ?? 'qa-output/m11'
mkdirSync(SALIDA, { recursive: true })

const step = (m) => console.log(`✓ ${m}`)
const fail = (m) => { throw new Error(m) }
const sufijo = Date.now().toString(36)
const CORREO_LARGO = `maria.prueba.${sufijo}@ejemplo-test-con-dominio-largo.local`
const ADMIN = { correo: `dir.prim.${sufijo}@demo.edugrid.mx`, contrasena: 'Primaria-2026-ok' }

// QA_PROXY=<url> si la red sale por un proxy (por ejemplo, para probar el preview de Vercel).
const browser = await chromium.launch(process.env.QA_PROXY ? { proxy: { server: process.env.QA_PROXY } } : {})
const errors = []
const nuevaPagina = async (viewport = { width: 1280, height: 900 }, colorScheme = 'light') => {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true, colorScheme, deviceScaleFactor: 2 })
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
const entrar = async (page, correo, contrasena) => {
  await page.goto(`${BASE}#/`)
  await page.getByLabel('Correo electrónico').fill(correo)
  await page.getByLabel('Contraseña').fill(contrasena)
  await page.getByRole('button', { name: 'Entrar' }).click()
}
const leerDescarga = async (d) => {
  const t = []
  for await (const c of await d.createReadStream()) t.push(c)
  const libro = XLSX.read(Buffer.concat(t))
  return { nombre: d.suggestedFilename(), filas: XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]], { header: 1 }) }
}
const exportar = async (page, donde = page) => {
  const [d] = await Promise.all([page.waitForEvent('download'), donde.getByRole('button', { name: 'Exportar' }).first().click()])
  const x = await leerDescarga(d)
  if (!x.nombre.endsWith('.xlsx')) fail(`La exportación no es .xlsx: ${x.nombre}`)
  return x
}
const subirExcel = async (page, nombre, filas) => {
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filas), 'Hoja')
  const buffer = XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' })
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByText('Importar Excel', { exact: true }).click()])
  await chooser.setFiles({ name: nombre, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer })
}
/** Un correo en la vista previa: una sola línea, recortado con «…» si no cabe y completo en el título. */
const revisarCorreos = async (page, nombre) => {
  const correos = page.getByRole('dialog').locator('[data-correo-vista-previa]')
  await correos.first().waitFor({ timeout: 10000 }).catch(() => {})
  const n = await correos.count()
  if (n === 0) fail(`La vista previa de ${nombre} no muestra correos`)
  for (let i = 0; i < n; i++) {
    const c = await correos.nth(i).evaluate((el) => {
      const cs = getComputedStyle(el)
      const alto = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5
      return { blanco: cs.whiteSpace, corte: cs.textOverflow, lineas: Math.round(el.getBoundingClientRect().height / alto), titulo: el.getAttribute('title'), texto: el.textContent }
    })
    if (c.blanco !== 'nowrap' || c.corte !== 'ellipsis' || c.lineas > 1) fail(`En ${nombre} el correo «${c.texto}» se parte en ${c.lineas} líneas`)
    if (!c.titulo?.includes(c.texto.replace(/^Tutor: /, ''))) fail(`En ${nombre} el correo no muestra el título completo al pasar el cursor`)
  }
}

// 0. Escuela solo de Primaria (y otra escuela para revisar el aislamiento)
const reg = await api('cuenta/registro', { escuela: { nombre: `Escuela Solo Primaria ${sufijo} (DEMO)`, niveles: ['primaria'], correoContacto: `contacto.${sufijo}@demo.edugrid.mx` }, admin: { nombre: 'Dirección Primaria (DEMO)', ...ADMIN } })
if (reg.status !== 201) fail(`No se pudo registrar la escuela: ${JSON.stringify(reg.body)}`)
const regB = await api('cuenta/registro', { escuela: { nombre: `Escuela Vecina ${sufijo} (DEMO)`, niveles: ['primaria', 'secundaria'], correoContacto: `vecina.${sufijo}@demo.edugrid.mx` }, admin: { nombre: 'Dirección Vecina (DEMO)', correo: `dir.vecina.${sufijo}@demo.edugrid.mx`, contrasena: 'Vecina-2026-ok' } })
const p = await nuevaPagina()
await entrar(p, ADMIN.correo, ADMIN.contrasena)
await p.waitForURL(/#\/admin$/)

// 1. Tablero y Ciclos y grupos: solo Primaria
await p.getByText('6 grupos en Primaria').waitFor()
const niveles = p.locator('section', { has: p.getByRole('heading', { name: 'Alumnos por nivel' }) })
for (const n of ['Maternal', 'Kinder', 'Secundaria', 'Preparatoria']) if (await niveles.getByText(n, { exact: true }).count()) fail(`«Alumnos por nivel» muestra ${n}`)
await niveles.getByText('Primaria', { exact: true }).waitFor()
await p.getByText('Aún no hay avisos publicados').waitFor()
await p.screenshot({ path: `${SALIDA}/01-tablero-solo-primaria.png`, fullPage: true })
await p.goto(`${BASE}#/admin/escuela`)
await p.getByRole('heading', { name: 'Primaria', exact: true }).waitFor()
for (const n of ['Maternal', 'Kinder', 'Secundaria', 'Preparatoria']) if (await p.getByRole('heading', { name: n, exact: true }).count()) fail(`Ciclos y grupos muestra la sección vacía ${n}`)
await p.screenshot({ path: `${SALIDA}/02-ciclos-y-grupos-solo-primaria.png`, fullPage: true })
step('Escuela solo de Primaria: «6 grupos en Primaria», «Alumnos por nivel» y Ciclos y grupos muestran solo Primaria')

// 2. Importar alumnos: aviso antes de crear 2° B, correos sin cortes, una invitación por correo
await p.goto(`${BASE}#/admin/alumnos`)
const [plantilla] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Descargar plantilla' }).click()])
const titulos = (await leerDescarga(plantilla)).filas[0]
const fila = (o) => titulos.map((t) => o[String(t).replace(' *', '')] ?? '')
const alumnos = [
  fila({ 'Nombre(s)': 'Valeria', Apellidos: 'Prueba Luna (DEMO)', 'Fecha de nacimiento': '2017-03-14', Nivel: 'Primaria', Grado: 3, Grupo: 'A', 'Nombre del tutor': 'María', 'Apellidos del tutor': 'Prueba Sol (DEMO)', Parentesco: 'Madre', 'Correo del tutor': CORREO_LARGO }),
  fila({ 'Nombre(s)': 'Bruno', Apellidos: 'Prueba Luna (DEMO)', 'Fecha de nacimiento': '2019-09-02', Nivel: 'Primaria', Grado: 2, Grupo: 'B', 'Nombre del tutor': 'María', 'Apellidos del tutor': 'Prueba Sol (DEMO)', Parentesco: 'Madre', 'Correo del tutor': CORREO_LARGO }),
  fila({ 'Nombre(s)': 'Saúl', Apellidos: 'Otro Nivel (DEMO)', 'Fecha de nacimiento': '2012-01-01', Nivel: 'Secundaria', Grado: 1, Grupo: 'A' }),
]
const m = await nuevaPagina({ width: 390, height: 844 })
await entrar(m, ADMIN.correo, ADMIN.contrasena)
await m.waitForURL(/#\/admin$/)
await m.goto(`${BASE}#/admin/alumnos`)
await subirExcel(m, 'alumnos.xlsx', [titulos, ...alumnos])
const dlg = m.getByRole('dialog')
await dlg.locator('[data-grupos-nuevos]').getByText('2° de primaria B').waitFor()
await dlg.getByText('La importación creará el grupo').waitFor()
await dlg.locator('[data-fila="3"]').getByText('Se creará el grupo 2° de primaria B.').waitFor()
await dlg.locator('[data-fila="4"][data-estado="error"]').getByText('La escuela no tiene el nivel Secundaria').waitFor()
await revisarCorreos(m, 'alumnos')
await m.screenshot({ path: `${SALIDA}/03-vista-previa-alumnos-movil.png` })
await dlg.getByLabel(/consentimiento/).check()
await dlg.getByRole('button', { name: 'Importar 2 filas válidas' }).click()
const rep = dlg.locator('[data-reporte-importacion]')
await rep.getByText('Entraron 2 alumnos.', { exact: false }).waitFor()
await rep.getByText('Se creó el grupo 2° de primaria B.', { exact: false }).waitFor()
const ligaMaria = await rep.locator(`[data-liga-invitacion="${CORREO_LARGO}"]`).first().getAttribute('href')
if (!ligaMaria) fail('No se generó la invitación de la tutora')
if ((await rep.locator(`[data-liga-invitacion="${CORREO_LARGO}"]`).count()) !== 1) fail('Se generó más de una liga para el mismo correo')
await rep.getByText('Misma invitación').first().waitFor()
await dlg.getByRole('button', { name: 'Listo' }).click()
const invAlumnos = m.locator('[data-invitaciones-modulo="alumno"]')
await invAlumnos.locator(`[data-invitacion="${CORREO_LARGO}"][data-estado="pendiente"]`).getByText('Pendiente').waitFor()
await m.screenshot({ path: `${SALIDA}/04-alumnos-invitacion-pendiente-movil.png`, fullPage: true })
await p.goto(`${BASE}#/admin`)
await p.reload()
await p.getByText('7 grupos en Primaria').waitFor()
step('Importar alumnos avisa «La importación creará el grupo 2° de primaria B» antes de crearlo, rechaza niveles no contratados y el tablero cuenta 7 grupos')

// 3. Importar familias con el mismo correo: no se rechaza ni se duplica; sigue UNA invitación
await m.goto(`${BASE}#/admin/familias`)
const [pf] = await Promise.all([m.waitForEvent('download'), m.getByRole('button', { name: 'Descargar plantilla' }).click()])
const tf = (await leerDescarga(pf)).filas[0]
const ff = (o) => tf.map((t) => o[String(t).replace(' *', '')] ?? '')
await subirExcel(m, 'familias.xlsx', [tf, ff({ 'Nombre(s)': 'María', Apellidos: 'Prueba Sol (DEMO)', Parentesco: 'Madre', Correo: CORREO_LARGO, Teléfono: '5500000009' }), ff({ 'Nombre(s)': 'Ramón', Apellidos: 'Correo Larguísimo (DEMO)', Parentesco: 'Padre', Correo: `ramon.prueba.${sufijo}@ejemplo-test-con-dominio-largo.local` })])
await dlg.getByText('2 filas listas para importar').waitFor()
await dlg.locator('[data-fila="2"][data-estado="lista"]').getByText('se reutiliza', { exact: false }).waitFor()
await revisarCorreos(m, 'familias')
await m.screenshot({ path: `${SALIDA}/05-vista-previa-familias-movil.png` })
await dlg.getByRole('button', { name: 'Importar 2 filas válidas' }).click()
await rep.getByText('1 familia ya existía con ese correo', { exact: false }).waitFor()
await dlg.getByRole('button', { name: 'Listo' }).click()
const sesA = await sesionDe(p)
const lista = (await api('cuenta/invitaciones', undefined, sesA.token)).body.invitaciones
const deMaria = lista.filter((i) => i.correo === CORREO_LARGO)
if (deMaria.length !== 1) fail(`El correo de la tutora tiene ${deMaria.length} invitaciones (debe ser 1)`)
if (deMaria[0].perfiles.length !== 3) fail(`La invitación debe dar 3 perfiles (familia + 2 alumnos), da ${deMaria[0].perfiles.length}`)
const datos = (await api('datos', undefined, sesA.token)).body
if (datos.guardians.filter((g) => g.email === CORREO_LARGO).length !== 1) fail('La familia quedó duplicada')
await m.locator('[data-invitaciones-modulo="familia"]').locator(`[data-invitacion="${CORREO_LARGO}"]`).getByText('Pendiente').waitFor()
step('Importar familias con el correo que ya creó la importación de alumnos: no se rechaza, no se duplica y sigue habiendo UNA invitación (familia + 2 alumnos)')

// 4. Docentes: vista previa sin cortes y alta con Materia
await m.goto(`${BASE}#/admin/docentes`)
const [pd] = await Promise.all([m.waitForEvent('download'), m.getByRole('button', { name: 'Descargar plantilla' }).click()])
const td = (await leerDescarga(pd)).filas[0]
const fd = (o) => td.map((t) => o[String(t).replace(' *', '')] ?? '')
await subirExcel(m, 'docentes.xlsx', [td, fd({ 'Nombre(s)': 'Iván', Apellidos: 'Correo Largo (DEMO)', Especialidad: 'Inglés', Correo: `ivan.docente.${sufijo}@ejemplo-test-con-dominio-largo.local` })])
await revisarCorreos(m, 'docentes')
await m.screenshot({ path: `${SALIDA}/06-vista-previa-docentes-movil.png` })
await m.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()
await p.goto(`${BASE}#/admin/docentes`)
await p.reload()
await p.getByRole('button', { name: 'Registrar docente' }).click()
const form = p.getByRole('dialog')
await form.getByLabel('Nombre(s)').fill('Carmen')
await form.getByLabel('Apellidos').fill('Materia Prueba (DEMO)')
await form.getByLabel('Especialidad').fill('Matemáticas')
await form.getByLabel('Correo').fill(`carmen.${sufijo}@demo.edugrid.mx`)
await form.locator('[data-campo-materias]').getByLabel(/Matemáticas/).check()
await form.getByText('Se asignará en 7 grupos sin docente de Matemáticas.').waitFor()
await form.locator('[data-campo-materias]').getByLabel(/Inglés/).check()
await p.screenshot({ path: `${SALIDA}/07-docente-con-materia.png` })
await form.getByRole('button', { name: 'Guardar' }).click()
const filaCarmen = p.locator('tr', { hasText: 'Carmen Materia Prueba (DEMO)' })
await filaCarmen.locator('[data-materias-docente]').getByText('Matemáticas, Inglés · 7 grupos').waitFor()
await p.goto(`${BASE}#/admin/escuela`)
await p.getByRole('button', { name: 'Materias y docentes de 1° de primaria A' }).click()
const mat = p.getByRole('dialog').getByLabel('Matemáticas')
if (!(await mat.locator('option:checked').textContent())?.includes('Carmen Materia Prueba')) fail('En «Materias y docentes del grupo» Matemáticas no quedó con la docente')
await p.screenshot({ path: `${SALIDA}/08-materias-y-docentes-del-grupo.png` })
await p.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()
step('Docente creado con Materia: queda asignada en su ficha («Matemáticas, Inglés · 7 grupos») y en Materias y docentes del grupo; vista previa de docentes sin cortes')

// 5. Aceptar la invitación → la lista del admin dice «Aceptada»
const t = await nuevaPagina({ width: 390, height: 844 })
await t.goto(`${BASE}${ligaMaria}`)
await t.getByLabel('Crea tu contraseña').fill('Familia-Prim-1')
await t.getByLabel('Confirma tu contraseña').fill('Familia-Prim-1')
await t.getByRole('button', { name: 'Crear contraseña y entrar' }).click()
await t.waitForURL(/#\/familia$/)
const sesT = await sesionDe(t)
if (sesT.perfiles.map((x) => x.tipo).join(',') !== 'familia,alumno,alumno') fail(`La tutora debe tener familia + 2 alumnos: ${sesT.perfiles.map((x) => x.tipo)}`)
await p.goto(`${BASE}#/admin/alumnos`)
await p.locator('[data-invitaciones-modulo="alumno"]').locator(`[data-invitacion="${CORREO_LARGO}"][data-estado="aceptada"]`).getByText('Aceptada').waitFor()
await p.screenshot({ path: `${SALIDA}/09-alumnos-invitacion-aceptada.png`, fullPage: true })
await p.goto(`${BASE}#/admin/familias`)
await p.locator('[data-invitaciones-modulo="familia"]').locator(`[data-invitacion="${CORREO_LARGO}"][data-estado="aceptada"]`).waitFor()
await p.locator('[data-invitaciones-modulo="docente"]').count()
await p.goto(`${BASE}#/admin/docentes`)
await p.locator('[data-invitaciones-modulo="docente"]').locator(`[data-invitacion="carmen.${sufijo}@demo.edugrid.mx"]`).getByText('Pendiente').waitFor()
step('Al crear su contraseña con la liga, la invitación pasa a «Aceptada» en Alumnos y Familias; Docentes lista la suya como «Pendiente»')

// 6. Textos por rol y estados vacíos
await t.getByRole('button', { name: 'Cerrar sesión' }).click()
await t.getByLabel('Correo electrónico').fill(CORREO_LARGO)
await t.getByLabel('Contraseña').fill('Familia-Prim-1')
await t.getByRole('button', { name: 'Entrar' }).click()
await t.getByRole('button', { name: /Entrar como Alumno/ }).first().click()
await t.waitForURL(/#\/alumno$/)
await t.getByText(/Aún no hay clases registradas para el (lunes|martes|miércoles|jueves|viernes)/).waitFor()
await t.screenshot({ path: `${SALIDA}/10-alumno-sin-clases-movil.png`, fullPage: true })
const pB = await nuevaPagina()
await entrar(pB, `dir.vecina.${sufijo}@demo.edugrid.mx`, 'Vecina-2026-ok')
await pB.waitForURL(/#\/admin$/)
await pB.goto(`${BASE}#/admin/calificaciones`)
await pB.getByText('Este grupo aún no tiene materias con docente').waitFor()
if (await pB.getByText('No impartes').count()) fail('Calificaciones le habla al admin con voz de docente')
await pB.screenshot({ path: `${SALIDA}/11-calificaciones-admin-sin-materias.png`, fullPage: true })
await pB.goto(`${BASE}#/docente/asistencia`)
await pB.getByRole('heading', { name: 'Pase de lista' }).waitFor()
if (await pB.getByText('No tienes grupos asignados').count()) fail('Asistencia le habla al admin con voz de docente')
const alumna = datos.students.find((s) => s.firstName === 'Valeria')
await p.goto(`${BASE}#/alumnos/${alumna.id}`)
await p.locator('[data-titular]').waitFor()
if ((await p.locator('[data-titular]').textContent()) !== 'Sin asignar') fail('«Titular» de la ficha no dice «Sin asignar»')
if ((await p.locator('[data-salon]').textContent()) !== 'Sin asignar') fail('«Salón» de la ficha no dice «Sin asignar»')
await p.screenshot({ path: `${SALIDA}/12-ficha-alumna-titular-salon.png`, fullPage: true })
step('Admin: Calificaciones y Asistencia con textos de dirección; alumno sin horario ve «Aún no hay clases registradas…»; ficha con Titular y Salón «Sin asignar»')

// 7. Exportar en los 5 módulos (mismas columnas y filtros)
await p.goto(`${BASE}#/admin/alumnos`)
let x = await exportar(p)
if (x.filas[0].join('|') !== 'Alumno|Matrícula|Grupo|Consentimiento|Saldo' || x.filas.length !== 3) fail(`Exportar alumnos: ${JSON.stringify(x.filas)}`)
await p.getByLabel('Grupo', { exact: true }).selectOption({ label: '2° de primaria B' })
x = await exportar(p)
if (x.filas.length !== 2 || x.filas[1][2] !== '2° de primaria B') fail(`Exportar alumnos con filtro: ${JSON.stringify(x.filas)}`)
await p.goto(`${BASE}#/admin/docentes`)
x = await exportar(p)
if (x.filas[0][0] !== 'Docente' || !x.filas.some((f) => String(f[4]).includes('Matemáticas'))) fail(`Exportar docentes: ${JSON.stringify(x.filas)}`)
await p.goto(`${BASE}#/admin/familias`)
await p.getByLabel('Buscar por nombre, teléfono o hijo').fill('Ramón')
x = await exportar(p)
if (x.filas.length !== 2 || !String(x.filas[1][0]).startsWith('Ramón')) fail(`Exportar familias con búsqueda: ${JSON.stringify(x.filas)}`)
await p.goto(`${BASE}#/admin/calificaciones`)
await p.getByLabel('Grupo').selectOption({ label: '3° de primaria A' })
x = await exportar(p)
if (x.filas[0].join('|') !== 'Alumno|Calificación' || x.filas[1][0] !== 'Valeria Prueba Luna (DEMO)') fail(`Exportar calificaciones: ${JSON.stringify(x.filas)}`)
await p.goto(`${BASE}#/pagos`)
await p.getByRole('button', { name: 'Exportar' }).click()
await p.getByText('No hay filas para exportar con los filtros actuales.').waitFor()
const demo = await nuevaPagina()
await demo.goto(`${BASE}#/demo`)
await demo.getByRole('button', { name: /Entrar como Administrador/ }).first().click()
await demo.waitForURL(/#\/admin/)
await demo.goto(`${BASE}#/pagos`)
x = await exportar(demo)
if (x.filas[0].join('|') !== 'Alumno|Grupo|Vencido|Recordatorio' || x.filas.length < 2 || !x.nombre.includes('DEMO')) fail(`Exportar pagos: ${x.nombre} ${JSON.stringify(x.filas.slice(0, 2))}`)
step('Exportar descarga .xlsx en Alumnos (con filtro de grupo), Docentes, Familias (con búsqueda), Calificaciones y Pagos (en la demo, marcado DEMO)')

// 8. Aislamiento: la escuela vecina no abre la ficha de la alumna
await pB.goto(`${BASE}#/alumnos/${alumna.id}`)
await pB.getByText('No tienes acceso a esta información').waitFor()
const listaB = (await api('cuenta/invitaciones', undefined, regB.body.token)).body.invitaciones
if (listaB.some((i) => i.correo === CORREO_LARGO)) fail('La escuela vecina ve invitaciones de otra escuela')
step('La escuela vecina no abre la ficha de la alumna ni ve sus invitaciones')

// 9. Capturas: encabezados en móvil y modo oscuro
const o = await nuevaPagina({ width: 390, height: 844 }, 'dark')
await entrar(o, ADMIN.correo, ADMIN.contrasena)
await o.waitForURL(/#\/admin$/)
await o.goto(`${BASE}#/admin/alumnos`)
await o.locator('[data-invitaciones-modulo="alumno"]').getByText('Aceptada', { exact: true }).waitFor()
await o.screenshot({ path: `${SALIDA}/13-alumnos-oscuro-movil.png`, fullPage: true })

if (errors.length) fail(`Errores de JavaScript en la página: ${errors.join(' | ')}`)
console.log(`\nCorrecciones del Mensaje 11: todo en orden. Capturas en ${SALIDA}/`)
await browser.close()
