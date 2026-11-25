import type { Database, TableName } from '../../src/data/types'
import type { Consulta, Ejecutor } from './db.js'
import { migrar, puedeUsarRol, ROL_APP } from './esquema.js'
import { NOMBRES_TABLAS, tablaSql } from './tablas.js'

/** Cambio que la app pide guardar. Es el mismo contrato que `EdugridRepository`. */
export type Operacion =
  | { op: 'insert' | 'upsert'; tabla: TableName; filas: { id: string }[] }
  | { op: 'update'; tabla: TableName; id: string; cambios: Record<string, unknown>; quitar?: string[] }
  | { op: 'remove'; tabla: TableName; id: string }
  | { op: 'meta'; cambios: Record<string, unknown>; quitar?: string[] }
  | { op: 'reiniciar' }

export class NoEncontrado extends Error {}

const json = (v: unknown) => JSON.stringify(v)

/** Por cada conexión: ¿las consultas pueden correr con el rol edugrid_app (RLS efectivo)? */
const conRol = new WeakMap<Ejecutor, boolean>()

/**
 * Corre consultas de datos de UNA escuela: dentro de una transacción que fija
 * `edugrid.escuela` (lo que usan las políticas RLS) y, si se puede, cambia al rol
 * edugrid_app. Además, cada consulta filtra por school_id por su cuenta.
 */
async function enEscuela(db: Ejecutor, escuela: string, consultas: Consulta[]): Promise<Record<string, unknown>[][]> {
  const previas: Consulta[] = [{ text: `select set_config('edugrid.escuela', $1, true)`, params: [escuela] }]
  if (conRol.get(db)) previas.push({ text: `set local role ${ROL_APP}` })
  const r = await db.transaccion([...previas, ...consultas])
  return r.slice(previas.length)
}

const una = async (db: Ejecutor, escuela: string, c: Consulta) => (await enEscuela(db, escuela, [c]))[0] ?? []

/** Cómo queda protegido el aislamiento entre escuelas en esta base (para /api/salud). */
export const aislamiento = (db: Ejecutor): 'rls' | 'filtro' => (conRol.get(db) ? 'rls' : 'filtro')

/**
 * Todas las consultas reciben la escuela (`school_id`) como primer parámetro y
 * filtran por ella: así una escuela nunca lee ni cambia datos de otra.
 */
function insertarFilas(escuela: string, tabla: TableName, filas: unknown[]): Consulta {
  return {
    text: `insert into ${tablaSql(tabla)} (school_id, id, data)
select $1, f->>'id', f from jsonb_array_elements($2::jsonb) with ordinality as e(f, n) order by n
on conflict (school_id, id) do update set data = excluded.data, actualizado = now()`,
    params: [escuela, json(filas)],
  }
}

/** Borra los datos de esa escuela y vuelve a cargar la semilla DEMO, en una sola transacción. */
export async function cargarSemilla(db: Ejecutor, escuela: string, semilla: Database): Promise<void> {
  const consultas: Consulta[] = [
    // Al borrar la escuela se borran en cascada sus filas de todas las tablas (y de ninguna otra escuela).
    { text: 'delete from "escuelas" where school_id = $1', params: [escuela] },
    { text: 'insert into "escuelas" (school_id, data) values ($1, $2::jsonb)', params: [escuela, json(semilla.meta)] },
  ]
  for (const t of NOMBRES_TABLAS) {
    const filas = semilla[t] as unknown[]
    if (filas.length) consultas.push(insertarFilas(escuela, t, filas))
  }
  await enEscuela(db, escuela, consultas)
}

const listas = new Map<string, Promise<void>>()

/**
 * La primera vez que se usa la API crea las tablas que falten y, si la escuela
 * no tiene datos, carga la semilla DEMO (salvo que EDUGRID_SEMILLA_DEMO=no).
 */
export function prepararBase(db: Ejecutor, escuela: string, semilla: () => Database, cargarDemo: boolean): Promise<void> {
  let listo = listas.get(escuela)
  if (!listo) {
    listo = (async () => {
      await migrar(db)
      conRol.set(db, await puedeUsarRol(db))
      const existe = await una(db, escuela, { text: 'select 1 from "escuelas" where school_id = $1', params: [escuela] })
      if (existe.length === 0 && cargarDemo) await cargarSemilla(db, escuela, semilla())
    })().catch((e: unknown) => {
      listas.delete(escuela)
      throw e
    })
    listas.set(escuela, listo)
  }
  return listo
}

/** Solo para pruebas: olvida que la base ya se preparó. */
export const olvidarPreparacion = () => listas.clear()

/** Todos los datos en una sola consulta, en el orden en que se guardaron. */
export async function leerTodo(db: Ejecutor, escuela: string): Promise<Database> {
  const partes = NOMBRES_TABLAS.map(
    (t) => `'${t}', (select coalesce(json_agg(data order by orden), '[]'::json) from ${tablaSql(t)} where school_id = $1)`,
  )
  // json_build_object acepta hasta 100 argumentos: se arma por bloques y se unen.
  const bloques: string[] = []
  for (let i = 0; i < partes.length; i += 40) bloques.push(`jsonb_build_object(${partes.slice(i, i + 40).join(', ')})`)
  const filas = await una(db, escuela, {
    text: `select jsonb_build_object('meta', (select data from "escuelas" where school_id = $1)) || ${bloques.join(' || ')} as db`,
    params: [escuela],
  })
  const db0 = filas[0]?.db
  const datos = (typeof db0 === 'string' ? JSON.parse(db0) : db0) as Database
  if (!datos.meta) throw new NoEncontrado('Esta escuela todavía no tiene datos. Usa «Restablecer datos demo» para cargar los datos de ejemplo.')
  return datos
}

export async function aplicar(db: Ejecutor, escuela: string, o: Operacion, semilla: () => Database): Promise<void> {
  switch (o.op) {
    case 'insert':
    case 'upsert':
      if (o.filas.length) await una(db, escuela, insertarFilas(escuela, o.tabla, o.filas))
      return
    case 'update': {
      const filas = await una(db, escuela, {
        text: `update ${tablaSql(o.tabla)} set data = (data - $4::text[]) || $3::jsonb, actualizado = now()
where school_id = $1 and id = $2 returning id`,
        params: [escuela, o.id, json(o.cambios), o.quitar ?? []],
      })
      if (filas.length === 0) throw new NoEncontrado(`No se encontró el registro ${o.id}`)
      return
    }
    case 'remove':
      await una(db, escuela, { text: `delete from ${tablaSql(o.tabla)} where school_id = $1 and id = $2`, params: [escuela, o.id] })
      return
    case 'meta': {
      const filas = await una(db, escuela, {
        text: `update "escuelas" set data = (data - $3::text[]) || $2::jsonb, actualizado = now() where school_id = $1 returning school_id`,
        params: [escuela, json(o.cambios), o.quitar ?? []],
      })
      if (filas.length === 0) throw new NoEncontrado('Esta escuela todavía no tiene datos.')
      return
    }
    case 'reiniciar':
      await cargarSemilla(db, escuela, semilla())
      return
  }
}

/** Conteos rápidos para la página de salud. */
export async function contar(db: Ejecutor, escuela: string): Promise<Record<string, number>> {
  const sql = NOMBRES_TABLAS.map((t) => `select '${t}' as tabla, count(*)::int as n from ${tablaSql(t)} where school_id = $1`).join(' union all ')
  const filas = await una(db, escuela, { text: sql, params: [escuela] })
  return Object.fromEntries(filas.map((f) => [String(f.tabla), Number(f.n)]))
}

