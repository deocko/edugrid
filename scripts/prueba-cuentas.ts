/**
 * Prueba de las cuentas reales (Mensaje 10) con Postgres en memoria (PGlite):
 * alta de escuela, inicio de sesión, invitaciones, recuperar contraseña, prueba
 * de 30 días y aislamiento entre escuelas. Corre: npm run prueba:api
 */
import { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ejecutorPglite } from '../servidor/pglite'
import { manejarCuenta, manejarDatos, type Entorno } from '../api/_lib/http'
import { hashContrasena, verificarContrasena } from '../api/_lib/cuentas'
import { NOMBRES_TABLAS } from '../api/_lib/tablas'
import { TODAS_LAS_TABLAS } from '../src/data/escuelaNueva'
import type { Database } from '../src/data/types'
import type { InvitacionPublica, ResultadoInvitacion, SesionPublica } from '../src/data/cuentaTipos'

const semilla = JSON.parse(readFileSync('src/data/seed.json', 'utf8')) as Database
const pg = new PGlite()
const ejecutor = ejecutorPglite(pg)
let reloj = Date.parse('2026-11-25T10:00:00Z')
const variables: Record<string, string | undefined> = { EDUGRID_SIMULAR_PRUEBA: 'si' }
const entorno: Entorno = { ejecutor: () => ejecutor, semilla: () => semilla, variables, ahora: () => new Date(reloj) }
const BASE = 'https://edugrid.test/api'
let pasos = 0
// El correo demo escribe cada mensaje en el log; aquí se omite para que la salida se lea fácil.
const log = console.log
console.log = (...a: unknown[]) => (String(a[0]).startsWith('[edugrid-correo') ? undefined : log(...a))
const ok = (m: string) => console.log(`✓ ${++pasos}. ${m}`)

const cuenta = async (accion: string, cuerpo?: unknown, token?: string, query = '') => {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  const r = await manejarCuenta(new Request(`${BASE}/cuenta/${accion}${query}`, cuerpo === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(cuerpo) }), entorno)
  return { status: r.status, body: (await r.json()) as Record<string, unknown> }
}
const datos = async (token?: string, cuerpo?: unknown) => {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  const r = await manejarDatos(new Request(`${BASE}/datos`, cuerpo === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(cuerpo) }), entorno)
  return { status: r.status, body: (await r.json()) as Database & { error?: string } }
}

assert.deepEqual([...TODAS_LAS_TABLAS].sort(), [...NOMBRES_TABLAS].sort())

// Hash de contraseña
const h = await hashContrasena('una contraseña larga')
assert.match(h, /^scrypt\$/)
assert.ok(!h.includes('una contraseña'))
assert.equal(await verificarContrasena('una contraseña larga', h), true)
assert.equal(await verificarContrasena('otra', h), false)
ok('las contraseñas se guardan como hash scrypt y solo la correcta coincide')

// 1. Alta de escuela con wizard
const registro = (nombre: string, correo: string) => ({
  escuela: { nombre, niveles: ['primaria', 'secundaria'], correoContacto: `contacto@${nombre.toLowerCase().replace(/\W/g, '')}.demo` },
  admin: { nombre: `Dirección ${nombre}`, correo, contrasena: 'Secreta-2026' },
})
let r = await cuenta('registro', { ...registro('Colegio Faro DEMO', 'dir@faro.demo'), admin: { nombre: 'X', correo: 'dir@faro.demo', contrasena: 'corta' } })
assert.equal(r.status, 400)
r = await cuenta('registro', registro('Colegio Faro DEMO', 'Dir@Faro.demo'))
assert.equal(r.status, 201, JSON.stringify(r.body))
const a = r.body as unknown as SesionPublica
assert.equal(a.escuela.nombre, 'Colegio Faro DEMO')
assert.equal(a.escuela.diasRestantes, 30)
assert.equal(a.perfil?.tipo, 'administrador')
assert.equal(a.usuario.correo, 'dir@faro.demo')
const fila = await ejecutor.consulta(`select hash_contrasena from "usuarios" where correo = 'dir@faro.demo'`)
assert.ok(!String(fila[0]?.hash_contrasena).includes('Secreta'))
const dbA = (await datos(a.token)).body
assert.equal(dbA.meta.school.name, 'Colegio Faro DEMO')
assert.equal(dbA.students.length, 0)
assert.equal(dbA.staff[0]?.id, a.perfil?.referencia)
assert.ok(dbA.grades.some((g) => g.level === 'primaria') && !dbA.grades.some((g) => g.level === 'kinder'))
ok('el wizard crea escuela + administrador + sesión, con 30 días de prueba y sus grados')

// 2. Iniciar y cerrar sesión
r = await cuenta('iniciar', { correo: 'dir@faro.demo', contrasena: 'equivocada' })
assert.equal(r.status, 401)
r = await cuenta('iniciar', { correo: 'nadie@faro.demo', contrasena: 'Secreta-2026' })
assert.equal(r.status, 401)
r = await cuenta('iniciar', { correo: ' DIR@faro.demo ', contrasena: 'Secreta-2026' })
assert.equal(r.status, 200)
const t2 = (r.body.sesion as SesionPublica).token
assert.equal((await cuenta('sesion', undefined, t2)).status, 200)
assert.equal((await cuenta('cerrar', {}, t2)).status, 200)
assert.equal((await cuenta('sesion', undefined, t2)).status, 401)
assert.equal((await datos(t2)).status, 401)
assert.equal((await datos(`${a.escuela.id}.inventado-inventado-inventado`)).status, 401)
ok('contraseña incorrecta no entra; cerrar sesión invalida el token')

// 3. Otra escuela (B) no ve ni toca lo de A
r = await cuenta('registro', registro('Instituto Brisa DEMO', 'dir@brisa.demo'))
const b = r.body as unknown as SesionPublica
await datos(a.token, { op: 'insert', tabla: 'teachers', filas: [{ id: 't-a1', firstName: 'Ana', lastName: 'Faro', email: 'ana@faro.demo', phone: '', specialty: 'Español', active: true }] })
assert.equal((await datos(a.token)).body.teachers.length, 1)
assert.equal((await datos(b.token)).body.teachers.length, 0)
// Aunque B intente cambiar el id de A, solo afecta su propia escuela (el update no encuentra nada).
assert.equal((await datos(b.token, { op: 'update', tabla: 'teachers', id: 't-a1', cambios: { firstName: 'Intruso' } })).status, 404)
assert.equal((await datos(a.token)).body.teachers[0]?.firstName, 'Ana')
assert.equal((await datos(b.token, { op: 'reiniciar' })).status, 403)
// Sin sesión se sigue viendo el Colegio Demo como antes.
const demo = (await datos()).body
assert.equal(demo.meta.school.name, semilla.meta.school.name)
assert.equal(demo.students.length, semilla.students.length)
// RLS directo: con el rol de la app y la escuela B fijada, las tablas de cuentas solo muestran lo de B.
const comoApp = async (escuela: string, sql: string) => {
  const res = await ejecutor.transaccion([{ text: `select set_config('edugrid.escuela', $1, true)`, params: [escuela] }, { text: 'set local role edugrid_app' }, { text: sql }])
  return res.at(-1) ?? []
}
assert.deepEqual((await comoApp(b.escuela.id, 'select distinct school_id from "usuarios"')).map((f) => f.school_id), [b.escuela.id])
assert.equal((await comoApp(b.escuela.id, 'select count(*)::int as n from "sesiones"'))[0]?.n, 1)
assert.equal((await comoApp(b.escuela.id, `select count(*)::int as n from "teachers"`))[0]?.n, 0)
ok('la escuela B no ve ni modifica datos de la escuela A (RLS también en usuarios y sesiones)')

// 4. Invitación a un docente
r = await cuenta('invitar', { personas: [{ tipo: 'docente', referencia: 't-a1', correo: 'ana@faro.demo', nombre: 'Ana Faro' }] }, b.token)
assert.equal((r.body.resultados as ResultadoInvitacion[])[0]?.estado, 'error') // la ficha es de A, no de B
r = await cuenta('invitar', { personas: [{ tipo: 'docente', referencia: 't-a1', correo: 'ana@faro.demo', nombre: 'Ana Faro' }] }, a.token)
const inv = (r.body.resultados as ResultadoInvitacion[])[0]!
assert.equal(inv.estado, 'no-enviada')
assert.match(inv.liga ?? '', /#\/invitacion\//)
const tokInv = decodeURIComponent(inv.liga!.split('/invitacion/')[1]!)
const ver = (await cuenta('invitacion', undefined, undefined, `?token=${encodeURIComponent(tokInv)}`)).body as unknown as InvitacionPublica
assert.equal(ver.escuela, 'Colegio Faro DEMO')
assert.equal(ver.tipo, 'docente')
assert.equal(ver.cuentaActiva, false)
assert.equal((await cuenta('aceptar', { token: tokInv, contrasena: 'corta' })).status, 400)
r = await cuenta('aceptar', { token: tokInv, contrasena: 'Docente-2026' })
assert.equal(r.status, 200)
const doc = r.body as unknown as SesionPublica
assert.equal(doc.perfil?.tipo, 'docente')
assert.equal(doc.perfiles.length, 1)
assert.equal(doc.perfil?.nombre, 'Ana Faro')
assert.equal((await cuenta('aceptar', { token: tokInv, contrasena: 'Docente-2026' })).status, 410)
r = await cuenta('invitar', { personas: [{ tipo: 'docente', referencia: 't-a1', correo: 'ana@faro.demo', nombre: 'Ana Faro' }] }, a.token)
assert.equal((r.body.resultados as ResultadoInvitacion[])[0]?.estado, 'ya-tiene-perfil')
assert.equal((await cuenta('invitar', { personas: [{ tipo: 'docente', referencia: 't-a1', correo: 'x@x.demo', nombre: 'X' }] }, doc.token)).status, 403)
ok('el administrador invita a un docente; con la liga crea su contraseña y entra solo como docente')

// 5. Una cuenta por correo: la misma persona invitada como familia agrega el perfil a su cuenta
await datos(a.token, { op: 'insert', tabla: 'guardians', filas: [{ id: 'tu-a1', firstName: 'Ana', lastName: 'Faro', relation: 'Madre', email: 'ana@faro.demo', phone: '', rfc: '', taxName: '', taxZip: '', taxRegime: '', consentAt: null }] })
r = await cuenta('invitar', { personas: [{ tipo: 'familia', referencia: 'tu-a1', correo: 'ana@faro.demo', nombre: 'Ana Faro' }] }, a.token)
const tokFam = decodeURIComponent((r.body.resultados as ResultadoInvitacion[])[0]!.liga!.split('/invitacion/')[1]!)
assert.equal(((await cuenta('invitacion', undefined, undefined, `?token=${encodeURIComponent(tokFam)}`)).body as unknown as InvitacionPublica).cuentaActiva, true)
assert.equal((await cuenta('aceptar', { token: tokFam, contrasena: 'otra-distinta' })).status, 401)
r = await cuenta('aceptar', { token: tokFam, contrasena: 'Docente-2026' })
const fam = r.body as unknown as SesionPublica
assert.equal(fam.perfil?.tipo, 'familia')
assert.deepEqual(fam.perfiles.map((p) => p.tipo), ['docente', 'familia'])
assert.equal((await ejecutor.consulta(`select count(*)::int as n from "usuarios" where correo = 'ana@faro.demo'`))[0]?.n, 1)
r = await cuenta('perfil', { perfilId: fam.perfiles[0]!.id }, fam.token)
assert.equal((r.body as unknown as SesionPublica).perfil?.tipo, 'docente')
ok('si el correo ya tiene cuenta, la invitación solo agrega el perfil (una cuenta por correo)')

// 6. Recuperar contraseña
r = await cuenta('recuperar', { correo: 'nadie@faro.demo' })
assert.equal(r.status, 200)
assert.deepEqual(r.body.ligas, [])
r = await cuenta('recuperar', { correo: 'dir@faro.demo' })
const ligaRec = (r.body.ligas as string[])[0]!
assert.match(ligaRec, /#\/restablecer\//)
const tokRec = decodeURIComponent(ligaRec.split('/restablecer/')[1]!)
const viejo = (await cuenta('iniciar', { correo: 'dir@faro.demo', contrasena: 'Secreta-2026' })).body.sesion as SesionPublica
r = await cuenta('restablecer', { token: tokRec, contrasena: 'Nueva-Secreta-2026' })
assert.equal(r.status, 200)
assert.equal((r.body as unknown as SesionPublica).perfil?.tipo, 'administrador')
assert.equal((await cuenta('sesion', undefined, viejo.token)).status, 401)
assert.equal((await cuenta('iniciar', { correo: 'dir@faro.demo', contrasena: 'Secreta-2026' })).status, 401)
assert.equal((await cuenta('iniciar', { correo: 'dir@faro.demo', contrasena: 'Nueva-Secreta-2026' })).status, 200)
assert.equal((await cuenta('restablecer', { token: tokRec, contrasena: 'Otra-Mas-2026' })).status, 410)
// En producción y sin Resend no se muestran las ligas en pantalla.
variables.VERCEL_ENV = 'production'
r = await cuenta('recuperar', { correo: 'dir@faro.demo' })
assert.equal(r.body.ligas, undefined)
delete variables.VERCEL_ENV
ok('recuperar contraseña genera su liga (solo se muestra en pantalla fuera de producción)')

// 7. El mismo correo en dos escuelas: se elige la escuela
r = await cuenta('registro', registro('Colegio Cima DEMO', 'dir@faro.demo'))
assert.equal(r.status, 201)
const cima = r.body as unknown as SesionPublica
// En Cima su contraseña es «Secreta-2026»; en Faro, la nueva. Cada una abre solo su escuela.
r = await cuenta('iniciar', { correo: 'dir@faro.demo', contrasena: 'Secreta-2026' })
assert.equal((r.body.sesion as SesionPublica).escuela.id, cima.escuela.id)
// Con la misma contraseña en ambas, se pide elegir.
const tCima = (await cuenta('recuperar', { correo: 'dir@faro.demo' })).body.ligas as string[]
for (const l of tCima) await cuenta('restablecer', { token: decodeURIComponent(l.split('/restablecer/')[1]!), contrasena: 'Igual-En-Ambas-1' })
r = await cuenta('iniciar', { correo: 'dir@faro.demo', contrasena: 'Igual-En-Ambas-1' })
assert.equal((r.body.elegir as unknown[]).length, 2)
r = await cuenta('iniciar', { correo: 'dir@faro.demo', contrasena: 'Igual-En-Ambas-1', escuela: a.escuela.id })
assert.equal((r.body.sesion as SesionPublica).escuela.id, a.escuela.id)
ok('un correo con cuenta en dos escuelas elige a cuál entrar')

// 8b. Un tutor con dos hijos: una sola invitación aceptada le da su perfil de familia y el de cada hijo
const adm = (r.body.sesion as SesionPublica).token
await datos(adm, { op: 'lote', operaciones: [
  { op: 'insert', tabla: 'guardians', filas: [{ id: 'tu-m', firstName: 'Marta', lastName: 'Ríos', relation: 'Madre', email: 'marta@faro.demo', phone: '', rfc: '', taxName: '', taxZip: '', taxRegime: '', consentAt: null }] },
  { op: 'insert', tabla: 'students', filas: [
    { id: 'al-h1', firstName: 'Hugo', lastName: 'Ríos', birthDate: '2016-01-01', curp: 'PENDIENTE', groupId: '', guardianIds: ['tu-m'], enrollmentId: 'MAT-1', status: 'activo', createdAt: '', qrCode: 'q1' },
    { id: 'al-h2', firstName: 'Iris', lastName: 'Ríos', birthDate: '2018-01-01', curp: 'PENDIENTE', groupId: '', guardianIds: ['tu-m'], enrollmentId: 'MAT-2', status: 'activo', createdAt: '', qrCode: 'q2' },
  ] },
] })
r = await cuenta('invitar', { personas: [
  { tipo: 'familia', referencia: 'tu-m', correo: 'marta@faro.demo', nombre: 'Marta Ríos' },
  { tipo: 'alumno', referencia: 'al-h1', correo: 'marta@faro.demo', nombre: 'Hugo Ríos' },
  { tipo: 'alumno', referencia: 'al-h2', correo: 'marta@faro.demo', nombre: 'Iris Ríos' },
] }, adm)
const res = r.body.resultados as ResultadoInvitacion[]
assert.equal(res.length, 3)
r = await cuenta('aceptar', { token: decodeURIComponent(res[0]!.liga!.split('/invitacion/')[1]!), contrasena: 'Familia-2026' })
const marta = r.body as unknown as SesionPublica
assert.equal(marta.perfil?.tipo, 'familia')
assert.deepEqual(marta.perfiles.map((p) => `${p.tipo}:${p.nombre}`), ['familia:Marta Ríos', 'alumno:Hugo Ríos', 'alumno:Iris Ríos'])
assert.equal((await cuenta('aceptar', { token: decodeURIComponent(res[1]!.liga!.split('/invitacion/')[1]!), contrasena: 'Familia-2026' })).status, 410)
assert.equal((await ejecutor.consulta(`select count(*)::int as n from "usuarios" where correo = 'marta@faro.demo'`))[0]?.n, 1)
ok('una mamá con dos hijos acepta una sola invitación y entra con UNA cuenta (familia + cada hijo)')

// 8. Prueba de 30 días
// (la sesión dura 14 días: se vuelve a entrar después de adelantar el reloj)
const entrarA = async () => ((await cuenta('iniciar', { correo: 'dir@faro.demo', contrasena: 'Igual-En-Ambas-1', escuela: a.escuela.id })).body.sesion as SesionPublica)
reloj += 29.5 * 86_400_000
assert.equal((await entrarA()).escuela.diasRestantes, 1)
reloj += 86_400_000
const vencida = await entrarA()
const adminA = vencida.token
assert.equal(vencida.escuela.pruebaVencida, true)
assert.equal((await datos(adminA)).status, 402)
r = await cuenta('prueba', { accion: 'reiniciar' }, adminA)
assert.equal((r.body as unknown as SesionPublica).escuela.diasRestantes, 30)
r = await cuenta('prueba', { accion: 'vencer' }, adminA)
assert.equal((r.body as unknown as SesionPublica).escuela.pruebaVencida, true)
delete variables.EDUGRID_SIMULAR_PRUEBA
assert.equal((await cuenta('prueba', { accion: 'reiniciar' }, adminA)).status, 403)
ok('la prueba de 30 días cuenta los días, vence y bloquea los datos; simularla solo en desarrollo')

console.log(`\n${pasos} comprobaciones de cuentas correctas.`)
await pg.close()
