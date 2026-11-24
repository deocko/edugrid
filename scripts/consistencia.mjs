// Revisión de consistencia entre vistas (hallazgos de la revisión del artefacto demo).
// Uso: npm run build && npx vite preview --port 4173 &  luego  node scripts/consistencia.mjs
// Requiere Playwright instalado (npm i -D playwright o global con NODE_PATH).
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const BASE = process.env.QA_URL ?? 'http://localhost:4173/edugrid/'
const seed = JSON.parse(readFileSync(new URL('../src/data/seed.json', import.meta.url), 'utf8'))
const S = {
  admin: { role: 'admin', personId: 'adm1', name: 'Mtra. Patricia Ruiz' },
  docente: { role: 'docente', personId: 't14', name: 'Carmen Escobedo Salinas' },
  familia: { role: 'familia', personId: 'tu0', name: 'Laura Ortega Salinas' },
  regina: { role: 'alumno', personId: 'al1', name: 'Regina Méndez Ortega' },
}
const results = []
const check = (name, ok, detail = '') => results.push({ name, ok, detail })

const browser = await chromium.launch()
async function text(who, path, prep) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript((s) => localStorage.setItem('edugrid.demo.sesion', s), JSON.stringify(S[who]))
  const page = await ctx.newPage()
  await page.goto(`${BASE}#${path}`)
  await page.waitForLoadState('networkidle')
  if (prep) await prep(page)
  await page.waitForTimeout(150)
  const t = await page.innerText('main')
  await ctx.close()
  return t
}
const between = (t, a, b) => {
  const i = t.indexOf(a)
  if (i < 0) return ''
  const j = t.indexOf(b, i + a.length)
  return t.slice(i, j < 0 ? undefined : j)
}

// 1a. Mateo en 2° de primaria A en todas las vistas
// Los expedientes de los hijos inician contraídos: se abren para leer sus datos
const openFolders = async (page) => { const closed = page.locator('main button[aria-expanded="false"]'); while (await closed.count()) await closed.first().click() }
const mateoFam = await text('familia', '/familia', openFolders)
const mateoAdm = await text('admin', '/alumnos/al2')
check('1a Mateo en 2° de primaria A (Familia y Admin)', mateoFam.includes('Mateo Méndez Ortega') && /Mateo Méndez Ortega\s+2° de primaria A/.test(mateoFam) && mateoAdm.includes('2° de primaria A') && !/secundaria/.test(mateoAdm.split('Datos generales')[0]))

// 1b. Asistencia de Regina igual en Familia y Admin
const pct = (t) => (t.match(/(\d{1,3})%\s*\n*\s*Asistencia/) ?? [])[1]
const famAsis = await text('familia', '/familia/hijo/al1', (p) => p.getByRole('tab', { name: 'Asistencia' }).click())
const admAsis = await text('admin', '/alumnos/al1')
check('1b Asistencia de Regina igual (Familia vs Admin)', pct(famAsis) && pct(famAsis) === pct(admAsis), `Familia ${pct(famAsis)}% · Admin ${pct(admAsis)}%`)

// 1c. Martes de 4° A idéntico en Docente y Alumno
const tue = (t) => between(t, 'Martes', 'Miércoles').split('\n').map((l) => l.trim()).filter((l) => /^\d\d:\d\d|^[A-ZÁÉÍÓÚ][A-Za-záéíóúñÁÉÍÓÚ ]+$/.test(l) && !['Martes', 'Hoy'].includes(l)).filter((l) => !/Escobedo|Aguilar|Fuentes/.test(l))
const tDoc = tue(await text('docente', '/docente/horario'))
const tAlu = tue(await text('regina', '/alumno/horario'))
const expected = ['08:00 – 08:50', 'Ciencias Naturales', '08:50 – 09:40', 'Historia', '09:40 – 10:30', 'Inglés', '10:30 – 11:00 · Recreo', '11:00 – 11:50', 'Educación Física', '11:50 – 12:40', 'Español']
check('1c Martes 4° A: Docente = Alumno = CN, Historia, Inglés, recreo, EF, Español', JSON.stringify(tDoc) === JSON.stringify(expected) && JSON.stringify(tAlu) === JSON.stringify(expected), `Docente ${tDoc.join(' | ')} || Alumno ${tAlu.join(' | ')}`)

// 1d. Calendario Familia: cada hijo solo sus tareas, distintas por grado, ≤3 por día
const kids = seed.students.filter((s) => s.guardianIds.includes('tu0'))
const hw = seed.homework.filter((h) => kids.some((k) => k.groupId === h.groupId))
const perDay = {}
for (const h of hw) perDay[`${h.groupId} ${h.dueDate}`] = (perDay[`${h.groupId} ${h.dueDate}`] ?? 0) + 1
const titles = kids.map((k) => new Set(seed.homework.filter((h) => h.groupId === k.groupId).map((h) => h.title)))
const shared = [...titles[0]].filter((t) => titles[1].has(t))
const calReg = await text('familia', '/familia/calendario', (p) => p.getByRole('tab', { name: 'Regina' }).click())
check('1d Calendario Familia: tareas por hijo, distintas y ≤3 por día', Math.max(...Object.values(perDay)) <= 3 && shared.length === 0 && calReg.includes('Regina:') && !calReg.includes('Mateo:'), `máx/día ${Math.max(...Object.values(perDay))}, títulos compartidos ${shared.length}`)

// 1e. Sin nombres duplicados
const names = seed.students.map((s) => `${s.firstName} ${s.lastName}`)
const dup = names.filter((n, i) => names.indexOf(n) !== i)
check('1e Sin alumnos con nombre duplicado (p. ej. Regina Arellano Treviño)', dup.length === 0, dup.join(', '))

// 1f. Referencias REF-DEMO secuenciales y sin huecos
const refs = seed.payments.map((p) => Number(p.reference.replace('REF-DEMO-', ''))).sort((a, b) => a - b)
const gaps = refs.filter((n, i) => i > 0 && n !== refs[i - 1] + 1)
check('1f Todos los pagos con REF-DEMO consecutiva', seed.payments.every((p) => /^REF-DEMO-\d+$/.test(p.reference)) && gaps.length === 0, `${refs[0]}…${refs.at(-1)} (${refs.length})`)

// 1g. Bitácora sin fechas futuras respecto al día simulado
const MES = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sept: 8, sep: 8, oct: 9, nov: 10, dic: 11 }
const bit = await text('admin', '/admin/bitacora')
const fechas = [...bit.matchAll(/(\d{1,2}) (ene|feb|mar|abr|may|jun|jul|ago|sept?|oct|nov|dic)\.?(?: (\d{4}))?/g)].map((m) => new Date(Number(m[3] ?? 2026), MES[m[2]], Number(m[1])))
const futuras = fechas.filter((d) => d > new Date(2026, 10, 24)).concat(seed.audit.filter((a) => a.at.slice(0, 10) > '2026-11-24').map((a) => new Date(a.at)))
check('1g Bitácora sin fechas posteriores al 24 nov 2026', fechas.length > 0 && futuras.length === 0, `${fechas.length} fechas, ${futuras.length} futuras`)

// 2. Tareas de 4° de primaria propias del grado
const hw4 = seed.homework.filter((h) => h.groupId === 'gr-primaria-4A')
const per4 = {}
for (const h of hw4) per4[h.dueDate] = (per4[h.dueDate] ?? 0) + 1
check('2 4° de primaria sin ecuaciones lineales ni carta formal, ≤3 por día', !hw4.some((h) => /ecuaciones lineales|carta formal/i.test(h.title)) && Math.max(...Object.values(per4)) <= 3, hw4.map((h) => h.title).join(' · '))

// 3. Familia Ortega Salinas no ve la feria de secundaria
const avisos = await text('familia', '/avisos')
check('3 Familia ve solo los avisos de sus niveles (Feria de primaria sí; kinder y secundaria no)', avisos.includes('Feria de ciencias de primaria') && !avisos.includes('Nuevo horario de entrada en kinder') && !avisos.includes('Campaña de vacunación en secundaria') && avisos.includes('Festival de invierno'))

// 4. Selector de docente
const ctx = await browser.newContext()
const page = await ctx.newPage()
await page.goto(BASE)
await page.waitForLoadState('networkidle')
const opt = await page.locator('#cuenta-docente option:checked').innerText()
check('4 Selector Docente: «Carmen Escobedo Salinas · 4° de primaria A (titular)»', opt === 'Carmen Escobedo Salinas · 4° de primaria A (titular)', opt)

// 7. Restablecer datos demo con confirmación
await page.getByRole('button', { name: 'Restablecer datos demo' }).click()
const q = await page.getByText('¿Seguro que quieres restablecer los datos demo?').isVisible()
await page.getByRole('button', { name: 'Sí, restablecer' }).click()
await page.getByText('Listo: los datos demo se restablecieron').waitFor({ timeout: 5000 })
check('7 Restablecer pide confirmación y muestra éxito', q)
await ctx.close()

// Promedio de Regina (dato de referencia)
check('Ref. Regina con promedio 8.5 (Familia)', /Regina Méndez Ortega[\s\S]{0,400}8\.5/.test(mateoFam))

// 5. Factura demo ya emitida con XML y PDF visibles
const fac = await text('admin', '/facturacion')
const xml = await text('admin', '/facturacion', async (p) => { await p.getByRole('button', { name: /XML/ }).first().click() })
check('5 Factura CFDI-DEMO-1 emitida, XML visible, avisos de pruebas y configuración incompleta', xml.includes('cfdi:Comprobante') && fac.includes('CFDI-DEMO-1') && fac.includes('Modo de pruebas') && fac.includes('Configuración incompleta') && seed.invoices[0]?.xml.includes('Rfc="DEMO123456T78"') && seed.invoices[0]?.xml.includes('UsoCFDI="G03"') && seed.invoices[0]?.xml.includes('MetodoPago="PUE"') && seed.invoices[0]?.xml.includes('RegimenFiscal="601"'))

// 8. Etiqueta de módulo en cada vista
const modulos = [['admin', '/admin', 'EDUGRID Admin'], ['docente', '/docente', 'EDUGRID Academy'], ['familia', '/familia', 'EDUGRID Family'], ['regina', '/alumno', 'EDUGRID Student'], ['familia', '/avisos', 'EDUGRID Connect'], ['admin', '/pagos', 'EDUGRID Pay'], ['admin', '/facturacion', 'EDUGRID Pay'], ['familia', '/familia/pagos', 'EDUGRID Pay']]
const malos = []
for (const [w, r, m] of modulos) if (!(await text(w, r)).startsWith(m)) malos.push(r)
check('8 Cada vista muestra su módulo', malos.length === 0, malos.join(', '))

// 9. Lenguaje claro
const cal = await text('docente', '/docente/calificaciones')
check('9 Docente sin calificaciones del 2º trimestre ve el aviso', cal.includes('Aún no hay calificaciones capturadas en este trimestre'))
check('9 Glosario CFDI/CSD/PAC/PUE en Facturación', ['factura electrónica', 'certificado del SAT', 'proveedor que timbra la factura', 'pago en una sola exhibición'].every((x) => fac.includes(x)))

await browser.close()
for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.detail ? `  [${r.detail}]` : ''}`)
const fail = results.filter((r) => !r.ok).length
console.log(`\n${results.length - fail}/${results.length} revisiones correctas`)
process.exit(fail ? 1 : 0)
