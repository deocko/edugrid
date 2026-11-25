import type { Database } from '../../src/data/types'
import { FaltaConfiguracion, type Ejecutor } from './db.js'
import { MIGRACIONES } from './esquema.js'
import { aislamiento, aplicar, contar, leerTodo, NoEncontrado, prepararBase, type Operacion } from './servicio.js'
import { esTabla } from './tablas.js'

export interface Entorno {
  /** Conexión a la base (se crea al pedirla para poder avisar si falta DATABASE_URL). */
  ejecutor: () => Ejecutor
  semilla: () => Database
  variables: Record<string, string | undefined>
}

class Invalida extends Error {}

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const listaDeTexto = (v: unknown): string[] | undefined => {
  if (v === undefined) return undefined
  if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return v
  throw new Invalida('«quitar» debe ser una lista de nombres de campo.')
}

/** Revisa que lo que llega del navegador tenga la forma esperada antes de tocar la base. */
export function leerOperacion(cuerpo: unknown): Operacion {
  if (!esObjeto(cuerpo)) throw new Invalida('Se esperaba un objeto JSON.')
  const { op } = cuerpo
  if (op === 'reiniciar') return { op }
  if (op === 'meta') {
    if (!esObjeto(cuerpo.cambios)) throw new Invalida('Faltan los cambios.')
    return { op, cambios: cuerpo.cambios, quitar: listaDeTexto(cuerpo.quitar) }
  }
  if (!esTabla(cuerpo.tabla)) throw new Invalida('Tabla desconocida.')
  const tabla = cuerpo.tabla
  if (op === 'insert' || op === 'upsert') {
    const filas = cuerpo.filas
    if (!Array.isArray(filas) || !filas.every((f) => esObjeto(f) && typeof f.id === 'string' && f.id !== ''))
      throw new Invalida('Cada fila necesita un «id».')
    return { op, tabla, filas: filas as { id: string }[] }
  }
  if (typeof cuerpo.id !== 'string' || cuerpo.id === '') throw new Invalida('Falta el «id».')
  if (op === 'remove') return { op, tabla, id: cuerpo.id }
  if (op === 'update') {
    if (!esObjeto(cuerpo.cambios)) throw new Invalida('Faltan los cambios.')
    if ('id' in cuerpo.cambios && cuerpo.cambios.id !== cuerpo.id) throw new Invalida('No se puede cambiar el «id».')
    return { op, tabla, id: cuerpo.id, cambios: cuerpo.cambios, quitar: listaDeTexto(cuerpo.quitar) }
  }
  throw new Invalida('Operación desconocida.')
}

function encabezados(req: Request, variables: Entorno['variables']): Headers {
  const h = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  // Solo hace falta si la app se publica en otro dominio (por ejemplo GitHub Pages).
  const origen = req.headers.get('origin')
  const permitidos = (variables.EDUGRID_ORIGENES ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (origen && permitidos.includes(origen)) {
    h.set('access-control-allow-origin', origen)
    h.set('access-control-allow-methods', 'GET, POST, OPTIONS')
    h.set('access-control-allow-headers', 'content-type')
    h.set('vary', 'origin')
  }
  return h
}

const responder = (h: Headers, estado: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: estado, headers: h })

function fallo(h: Headers, e: unknown): Response {
  if (e instanceof Invalida) return responder(h, 400, { error: e.message })
  if (e instanceof NoEncontrado) return responder(h, 404, { error: e.message })
  if (e instanceof FaltaConfiguracion) return responder(h, 503, { error: e.message })
  console.error('[edugrid-api]', e)
  return responder(h, 500, { error: 'No se pudo conectar con la base de datos. Intenta de nuevo en un momento.' })
}

const cargarDemo = (v: Entorno['variables']) => (v.EDUGRID_SEMILLA_DEMO ?? 'si').toLowerCase() !== 'no'

/**
 * Escuela de esta petición. Por ahora todo el servidor atiende a una escuela
 * (EDUGRID_ESCUELA, «demo» si no se configura); cuando haya inicio de sesión real
 * saldrá de la cuenta de la persona, nunca de lo que mande el navegador.
 */
export const escuelaDe = (v: Entorno['variables']): string => {
  const e = (v.EDUGRID_ESCUELA ?? '').trim() || 'demo'
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(e)) throw new FaltaConfiguracion('EDUGRID_ESCUELA solo admite minúsculas, números y guiones.')
  return e
}

/** /api/datos — GET devuelve todo; POST guarda un cambio. */
export async function manejarDatos(req: Request, entorno: Entorno): Promise<Response> {
  const h = encabezados(req, entorno.variables)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h })
  try {
    if (req.method !== 'GET' && req.method !== 'POST') return responder(h, 405, { error: 'Método no permitido.' })
    let operacion: Operacion | null = null
    if (req.method === 'POST') {
      let cuerpo: unknown
      try {
        cuerpo = await req.json()
      } catch {
        throw new Invalida('El cuerpo no es JSON válido.')
      }
      operacion = leerOperacion(cuerpo)
      if (operacion.op === 'reiniciar' && (entorno.variables.EDUGRID_PERMITIR_REINICIO ?? 'si').toLowerCase() === 'no')
        return responder(h, 403, { error: 'Restablecer los datos demo está desactivado en este servidor.' })
    }
    const escuela = escuelaDe(entorno.variables)
    const db = entorno.ejecutor()
    await prepararBase(db, escuela, entorno.semilla, cargarDemo(entorno.variables))
    if (!operacion) return responder(h, 200, await leerTodo(db, escuela))
    await aplicar(db, escuela, operacion, entorno.semilla)
    return responder(h, 200, { ok: true })
  } catch (e) {
    return fallo(h, e)
  }
}

/** /api/salud — para revisar desde el celular que todo está conectado. */
export async function manejarSalud(req: Request, entorno: Entorno): Promise<Response> {
  const h = encabezados(req, entorno.variables)
  try {
    const escuela = escuelaDe(entorno.variables)
    const db = entorno.ejecutor()
    await prepararBase(db, escuela, entorno.semilla, cargarDemo(entorno.variables))
    const conteos = await contar(db, escuela)
    const [ver] = await db.consulta('select max(version)::int as v from "edugrid_migraciones"')
    return responder(h, 200, {
      ok: true,
      mensaje: 'EDUGRID está conectado a la base de datos.',
      escuela,
      aislamiento: aislamiento(db) === 'rls' ? 'Row Level Security por escuela' : 'Filtro por escuela en cada consulta (el rol de la base omite RLS)',
      migracion: Number(ver?.v ?? 0),
      migracionEsperada: MIGRACIONES.at(-1)?.version ?? 0,
      registros: conteos,
    })
  } catch (e) {
    const r = fallo(h, e)
    const cuerpo = (await r.json()) as { error: string }
    return responder(h, r.status, { ok: false, ...cuerpo })
  }
}
