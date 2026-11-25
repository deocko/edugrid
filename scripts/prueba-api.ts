/**
 * Prueba de la API con una base Postgres real en memoria (PGlite), sin Neon ni
 * internet. Corre: npm run prueba:api
 *
 * Revisa que las tablas se crean solas, que la semilla DEMO se carga igual, que
 * el adaptador ApiRepository guarda lo mismo que el adaptador local y que la API
 * rechaza lo que no debe aceptar.
 */
import { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ejecutorNeon, type Ejecutor } from '../api/_lib/db'
import { ejecutorPglite } from '../servidor/pglite'
import { manejarDatos, manejarSalud, type Entorno } from '../api/_lib/http'
import { olvidarPreparacion } from '../api/_lib/servicio'
import { MIGRACIONES } from '../api/_lib/esquema'
import { ApiRepository } from '../src/data/apiAdapter'
import { LocalStorageRepository } from '../src/data/localAdapter'
import type { EdugridRepository } from '../src/data/repository'
import type { Database } from '../src/data/types'

const semilla = JSON.parse(readFileSync('src/data/seed.json', 'utf8')) as Database
const normal = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

const pg = new PGlite()
let consultas = 0
const base = ejecutorPglite(pg)
const ejecutor: Ejecutor = {
  consulta: (text, params) => (consultas++, base.consulta(text, params)),
  transaccion: (qs) => (consultas++, base.transaccion(qs)),
}

const variables: Record<string, string | undefined> = { EDUGRID_ORIGENES: 'https://deocko.github.io' }
const entorno: Entorno = { ejecutor: () => ejecutor, semilla: () => semilla, variables }
const BASE = 'https://edugrid.test/api'

// El adaptador del navegador habla con la API como si estuviera en Vercel.
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const req = new Request(input, init)
  const ruta = new URL(req.url).pathname
  if (ruta === '/api/datos') return manejarDatos(req, entorno)
  if (ruta === '/api/salud') return manejarSalud(req, entorno)
  return new Response('{}', { status: 404 })
}) as typeof fetch

const post = (cuerpo: unknown, extra: RequestInit = {}) =>
  manejarDatos(new Request(`${BASE}/datos`, { method: 'POST', body: JSON.stringify(cuerpo), ...extra }), entorno)

let pasos = 0
const ok = (texto: string) => {
  pasos++
  console.log(`  ✓ ${texto}`)
}

console.log('Prueba de la API de EDUGRID con PGlite')

// 1. Primera visita: crea tablas y carga la semilla.
const api = new ApiRepository(BASE, 0)
let r: Response
const primera = await api.snapshot()
assert.deepEqual(primera, normal(semilla))
ok('la base vacía se prepara sola y devuelve la semilla DEMO idéntica (mismo orden)')

const tablas = await ejecutor.consulta(`select count(*)::int as n from information_schema.tables where table_schema = 'public'`)
assert.equal(tablas[0]?.n, 31 + 2 + 5)
const sinSchool = await ejecutor.consulta(
  `select table_name from information_schema.tables t where table_schema = 'public' and table_name <> 'edugrid_migraciones'
   and not exists (select 1 from information_schema.columns c where c.table_name = t.table_name and c.column_name = 'school_id')`,
)
assert.deepEqual(sinSchool, [])
const conRls = await ejecutor.consulta(`select count(*)::int as n from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and relrowsecurity and relforcerowsecurity`)
assert.equal(conRls[0]?.n, 31 + 1 + 5)
ok('se crearon 31 tablas de datos + escuelas + 5 de cuentas + control de migraciones; todas con school_id y RLS forzado')

// 2. Salud.
const salud = (await (await fetch(`${BASE}/salud`)).json()) as { ok: boolean; registros: Record<string, number>; migracion: number }
assert.equal(salud.ok, true)
assert.equal(salud.registros.students, semilla.students.length)
assert.equal(salud.migracion, MIGRACIONES.length)
assert.match(String((salud as { aislamiento?: string }).aislamiento), /Row Level Security/)
ok(`/api/salud responde: ${salud.registros.students} alumnos, migración ${salud.migracion}`)

// 3. Las mismas operaciones en el adaptador local y en el de la API dan el mismo resultado.
const local: EdugridRepository = new LocalStorageRepository()
await local.reset()
const s0 = semilla.students[0]!
const g0 = semilla.groups[0]!
const operar = async (r: EdugridRepository) => {
  await r.insert('audit', [{ id: 'lg_prueba', at: '2026-11-25T08:00:00', actorKey: 'admin:x', actorName: 'Prueba', role: 'admin', action: 'Probó', detail: 'DEMO', kind: 'cambio' }])
  await r.update('students', s0.id, { firstName: 'Nombre Editado', photo: undefined })
  await r.upsert('groups', [{ ...g0, room: 'Aula de prueba' }])
  await r.upsert('rooms', [{ id: 'rm_prueba', name: 'Laboratorio DEMO', kind: 'laboratorio', capacity: 20 } as Database['rooms'][number]])
  await r.remove('notifications', semilla.notifications[0]!.id)
  await r.updateMeta({ checkinPlaces: ['Puerta principal', 'Puerta DEMO'] })
}
await operar(local)
let peticiones = 0
const fetchReal = globalThis.fetch
globalThis.fetch = ((...a: Parameters<typeof fetch>) => (peticiones++, fetchReal(...a))) as typeof fetch
await operar(api)
await api.confirmar()
globalThis.fetch = fetchReal
assert.equal(peticiones, 1, 'los 6 cambios seguidos deben viajar en un solo lote')
const esperado = normal(await local.snapshot())
const enApi = await api.snapshot()
assert.deepEqual(enApi, esperado)
const desdeServidor = await new ApiRepository(BASE).snapshot()
assert.deepEqual(desdeServidor, esperado)
ok('insert, update (incluye borrar un campo), upsert, remove y meta quedan igual que en el adaptador local, en una sola petición')

// Un lote es todo o nada: si un registro no existe, no se guarda ningún cambio del lote.
const antes = await new ApiRepository(BASE).snapshot()
r = await post({ op: 'lote', operaciones: [
  { op: 'update', tabla: 'students', id: s0.id, cambios: { firstName: 'No debe quedar' } },
  { op: 'update', tabla: 'students', id: 'no-existe', cambios: { firstName: 'X' } },
] })
assert.equal(r.status, 404)
assert.match(((await r.json()) as { error: string }).error, /No se encontró el registro no-existe/)
assert.deepEqual(await new ApiRepository(BASE).snapshot(), antes)
ok('un lote con un registro inexistente se deshace completo')

// 4. Errores claros.
r = await post({ op: 'insert', tabla: 'students; drop table students', filas: [] })
assert.equal(r.status, 400)
r = await post({ op: 'update', tabla: 'students', id: 'no-existe', cambios: { firstName: 'X' } })
assert.equal(r.status, 404)
assert.match(((await r.json()) as { error: string }).error, /No se encontró/)
r = await post({ op: 'insert', tabla: 'students', filas: [{ sinId: true }] })
assert.equal(r.status, 400)
r = await manejarDatos(new Request(`${BASE}/datos`, { method: 'POST', body: 'no es json' }), entorno)
assert.equal(r.status, 400)
r = await manejarDatos(new Request(`${BASE}/datos`, { method: 'DELETE' }), entorno)
assert.equal(r.status, 405)
await assert.rejects(api.update('students', 'no-existe', { firstName: 'X' }), /No se encontró/)
ok('rechaza tablas desconocidas, filas sin id, JSON inválido y registros que no existen (mensajes en español)')

// 5. CORS solo para los orígenes configurados.
r = await manejarDatos(new Request(`${BASE}/datos`, { method: 'OPTIONS', headers: { origin: 'https://deocko.github.io' } }), entorno)
assert.equal(r.headers.get('access-control-allow-origin'), 'https://deocko.github.io')
r = await manejarDatos(new Request(`${BASE}/datos`, { method: 'OPTIONS', headers: { origin: 'https://otro.example' } }), entorno)
assert.equal(r.headers.get('access-control-allow-origin'), null)
ok('CORS solo abre a los dominios de EDUGRID_ORIGENES')

// 6. Restablecer.
variables.EDUGRID_PERMITIR_REINICIO = 'no'
r = await post({ op: 'reiniciar' })
assert.equal(r.status, 403)
delete variables.EDUGRID_PERMITIR_REINICIO
await api.reset()
assert.deepEqual(await api.snapshot(), normal(semilla))
ok('«Restablecer datos demo» vuelve a la semilla (y se puede apagar con EDUGRID_PERMITIR_REINICIO=no)')

// 7. Dos escuelas en la misma base no se ven entre sí.
const montesol: Entorno = { ...entorno, variables: { ...variables, EDUGRID_ESCUELA: 'montesol' } }
const pedirMontesol = async (cuerpo?: unknown) =>
  manejarDatos(new Request(`${BASE}/datos`, cuerpo ? { method: 'POST', body: JSON.stringify(cuerpo) } : {}), montesol)
const m0 = (await (await pedirMontesol()).json()) as Database
assert.deepEqual(m0, normal(semilla))
assert.equal((await pedirMontesol({ op: 'remove', tabla: 'students', id: s0.id })).status, 200)
assert.equal((await pedirMontesol({ op: 'update', tabla: 'students', id: semilla.students[1]!.id, cambios: { firstName: 'Solo Montesol' } })).status, 200)
const demo = await new ApiRepository(BASE).snapshot()
assert.equal(demo.students.length, semilla.students.length)
assert.notEqual(demo.students[1]!.firstName, 'Solo Montesol')
assert.equal((await pedirMontesol({ op: 'reiniciar' })).status, 200)
assert.equal((await new ApiRepository(BASE).snapshot()).students.length, semilla.students.length)
assert.equal((await pedirMontesol({ op: 'remove', tabla: 'students', id: s0.id })).status, 200)
ok('dos escuelas en la misma base: lo que cambia o restablece una no toca a la otra')

// RLS directo en Postgres, con el rol de la app: sin escuela fijada no se ve nada,
// y con una escuela solo sus filas, aunque la consulta no filtre por school_id.
const comoApp = async (escuela: string | null) => {
  const previas = escuela ? [{ text: `select set_config('edugrid.escuela', $1, true)`, params: [escuela] }] : []
  const r = await ejecutor.transaccion([...previas, { text: 'set local role edugrid_app' }, { text: 'select count(*)::int as n from "students"' }])
  return Number(r.at(-1)?.[0]?.n)
}
assert.equal(await comoApp(null), 0)
assert.equal(await comoApp('demo'), semilla.students.length)
assert.equal(await comoApp('montesol'), semilla.students.length - 1)
await assert.rejects(
  ejecutor.transaccion([
    { text: `select set_config('edugrid.escuela', 'demo', true)` },
    { text: 'set local role edugrid_app' },
    { text: `insert into "rooms" (school_id, id, data) values ('montesol', 'rm_intruso', '{}'::jsonb)` },
  ]),
  /row-level security/,
)
ok('RLS: sin escuela no se ve nada, cada escuela ve solo lo suyo y no puede escribir en otra')

// 8. Volver a arrancar no repite migraciones ni borra datos.
await api.update('students', s0.id, { firstName: 'Sigue aquí' })
await api.confirmar()
olvidarPreparacion()
const despues = await new ApiRepository(BASE).snapshot()
assert.equal(despues.students[0]!.firstName, 'Sigue aquí')
const migs = await ejecutor.consulta('select count(*)::int as n from "edugrid_migraciones"')
assert.equal(migs[0]?.n, MIGRACIONES.length)
// Una base que se quedó en la migración 1 (como la de Neon antes de este cambio) recibe la 2 sola.
await ejecutor.consulta('delete from "edugrid_migraciones" where version = 2')
await ejecutor.consulta('drop function edugrid_exigir(bigint, text)')
olvidarPreparacion()
r = await post({ op: 'lote', operaciones: [{ op: 'update', tabla: 'students', id: 'no-existe', cambios: {} }] })
assert.equal(r.status, 404)
assert.equal((await ejecutor.consulta('select count(*)::int as n from "edugrid_migraciones"'))[0]?.n, MIGRACIONES.length)
ok('un arranque nuevo no repite migraciones ni toca los datos; una base en la migración 1 recibe la 2')

// 9. Sin semilla automática la base queda vacía y lo dice.
await pg.exec('drop schema public cascade; create schema public;')
olvidarPreparacion()
variables.EDUGRID_SEMILLA_DEMO = 'no'
r = await manejarDatos(new Request(`${BASE}/datos`), entorno)
assert.equal(r.status, 404)
assert.match(((await r.json()) as { error: string }).error, /todavía no tiene datos/)
delete variables.EDUGRID_SEMILLA_DEMO
ok('con EDUGRID_SEMILLA_DEMO=no no carga datos de ejemplo')

// 10. Sin DATABASE_URL avisa qué falta.
olvidarPreparacion()
r = await manejarSalud(new Request(`${BASE}/salud`), { ...entorno, ejecutor: () => ejecutorNeon(undefined) })
assert.equal(r.status, 503)
assert.match(((await r.json()) as { error: string }).error, /DATABASE_URL/)
ok('sin DATABASE_URL, /api/salud explica que falta configurarla')

console.log(`\n${pasos} comprobaciones correctas (${consultas} consultas a Postgres).`)
await pg.close()
