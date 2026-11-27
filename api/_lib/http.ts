import type { Database } from '../../src/data/types'
import { FaltaConfiguracion, type Ejecutor } from './db.js'
import { MIGRACIONES } from './esquema.js'
import { aislamiento, aplicar, contar, leerTodo, NoEncontrado, prepararBase, type Cambio, type Operacion } from './servicio.js'
import { esTabla } from './tablas.js'
import { correoDe, type AdaptadorCorreo } from './correo.js'
import {
  aceptarInvitacion,
  cambiarPerfil,
  cerrarSesion,
  ErrorCuenta,
  iniciarSesion,
  invitar,
  leerPersonas,
  leerRegistro,
  leerSesion,
  listarInvitaciones,
  recuperar,
  reenviarInvitacion,
  registrarEscuela,
  restablecer,
  simularPrueba,
  verInvitacion,
  type Ligas,
  type Opciones,
} from './cuentas.js'
import type { SesionPublica } from '../../src/data/cuentaTipos.js'

export interface Entorno {
  /** Conexión a la base (se crea al pedirla para poder avisar si falta DATABASE_URL). */
  ejecutor: () => Ejecutor
  semilla: () => Database
  variables: Record<string, string | undefined>
  /** Reloj del servidor (las pruebas lo pueden adelantar). */
  ahora?: () => Date
  /** Solo pruebas: un buzón en memoria en lugar de Resend o del correo demo. */
  correo?: AdaptadorCorreo
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
  if (op === 'lote') {
    const ops = cuerpo.operaciones
    if (!Array.isArray(ops) || ops.length > 500) throw new Invalida('El lote debe ser una lista de hasta 500 cambios.')
    return { op, operaciones: ops.map(leerCambio) }
  }
  return leerCambio(cuerpo)
}

function leerCambio(cuerpo: unknown): Cambio {
  if (!esObjeto(cuerpo)) throw new Invalida('Se esperaba un objeto JSON.')
  const { op } = cuerpo
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
    h.set('access-control-allow-headers', 'content-type, authorization')
    h.set('vary', 'origin')
  }
  return h
}

const responder = (h: Headers, estado: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: estado, headers: h })

function fallo(h: Headers, e: unknown): Response {
  if (e instanceof ErrorCuenta) return responder(h, e.estado, { error: e.message })
  if (e instanceof Invalida) return responder(h, 400, { error: e.message })
  if (e instanceof NoEncontrado) return responder(h, 404, { error: e.message })
  // edugrid_exigir: un registro del lote no existe; Postgres ya deshizo todo el lote.
  if (typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P0002')
    return responder(h, 404, { error: (e as { message?: string }).message ?? 'No se encontró el registro.' })
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

/** Token de sesión que manda el navegador en «Authorization: Bearer …». */
const tokenDe = (req: Request): string | null => {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') ?? '')
  return m ? m[1]! : null
}

const opcionesDe = (v: Entorno['variables'], entorno: Entorno): Opciones => ({
  ahora: entorno.ahora ?? (() => new Date()),
  puedeSimularPrueba: (v.EDUGRID_SIMULAR_PRUEBA ?? '').toLowerCase() === 'si' || v.VERCEL_ENV === 'preview' || v.VERCEL_ENV === 'development',
  contacto: (v.EDUGRID_CONTACTO ?? '').trim(),
})

/** Sesión obligatoria: si el token no sirve, 401 y la app vuelve a pedir correo y contraseña. */
async function sesionDe(req: Request, db: Ejecutor, op: Opciones): Promise<SesionPublica> {
  const token = tokenDe(req)
  const s = token ? await leerSesion(db, token, op) : null
  if (!s) throw new ErrorCuenta(401, 'Tu sesión terminó. Vuelve a iniciar sesión.')
  return s
}

/**
 * /api/datos — GET devuelve todo; POST guarda un cambio.
 * Con sesión, la escuela sale de la cuenta (nunca de lo que mande el navegador);
 * sin sesión, es la escuela demo (botón «Ver demo»).
 */
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
    const db = entorno.ejecutor()
    let escuela = escuelaDe(entorno.variables)
    let demo = true
    if (tokenDe(req)) {
      const sesion = await sesionDe(req, db, opcionesDe(entorno.variables, entorno))
      if (sesion.escuela.pruebaVencida) return responder(h, 402, { error: 'La prueba gratis de tu escuela terminó.', prueba: 'vencida' })
      if (!sesion.perfil) return responder(h, 403, { error: 'Elige con qué perfil quieres entrar.' })
      // Restablecer carga la semilla DEMO: en una escuela real borraría sus datos.
      if (operacion?.op === 'reiniciar') return responder(h, 403, { error: 'Restablecer datos demo solo existe en el Colegio Demo.' })
      escuela = sesion.escuela.id
      demo = false
    }
    await prepararBase(db, escuela, entorno.semilla, demo && cargarDemo(entorno.variables))
    if (!operacion) return responder(h, 200, await leerTodo(db, escuela))
    await aplicar(db, escuela, operacion, entorno.semilla)
    return responder(h, 200, { ok: true })
  } catch (e) {
    return fallo(h, e)
  }
}

/** Dirección de la app para las ligas de los correos. */
function urlApp(req: Request, v: Entorno['variables']): string {
  const fija = (v.EDUGRID_URL_APP ?? '').trim().replace(/\/+$/, '')
  if (fija) return fija
  const origen = req.headers.get('origin')
  const permitidos = (v.EDUGRID_ORIGENES ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (origen && permitidos.includes(origen)) return origen
  return new URL(req.url).origin
}

async function leerCuerpo(req: Request): Promise<Record<string, unknown>> {
  try {
    const c = (await req.json()) as unknown
    return typeof c === 'object' && c !== null && !Array.isArray(c) ? (c as Record<string, unknown>) : {}
  } catch {
    throw new Invalida('El cuerpo no es JSON válido.')
  }
}

/**
 * /api/cuenta/<acción> — inicio de sesión real y alta de escuelas.
 *   POST registro        Alta de escuela + administrador (wizard). Abre sesión.
 *   POST iniciar         Correo + contraseña. Abre sesión.
 *   POST cerrar          Cierra la sesión del token.
 *   GET  sesion          Sesión actual (usuario, perfiles, escuela y prueba).
 *   POST perfil          Cambia el perfil con el que se usa la app.
 *   POST recuperar       Manda la liga para crear una contraseña nueva.
 *   POST restablecer     Con esa liga, pone la contraseña nueva y entra.
 *   POST invitar         (administrador) Invita por correo a docentes, familias y alumnos.
 *   GET  invitaciones    (administrador) Invitaciones de la escuela con su estado.
 *   POST reenviar        (administrador) Reenvía una invitación con liga nueva.
 *   GET  invitacion      Datos de una invitación (?token=…).
 *   POST aceptar         Acepta la invitación con su contraseña y entra.
 *   POST prueba          (solo desarrollo y vista previa) Vence o reinicia la prueba de 30 días.
 */
export async function manejarCuenta(req: Request, entorno: Entorno): Promise<Response> {
  const h = encabezados(req, entorno.variables)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h })
  const url = new URL(req.url)
  const accion = url.pathname.replace(/\/+$/, '').split('/').pop() ?? ''
  const v = entorno.variables
  try {
    const op = opcionesDe(v, entorno)
    const db = entorno.ejecutor()
    const correo = entorno.correo ?? correoDe(v)
    const ligas: Ligas = { app: urlApp(req, v), correo, mostrar: correo.demo && v.VERCEL_ENV !== 'production' }
    const metodo = req.method
    const post = metodo === 'POST'
    if (metodo === 'GET' && accion === 'sesion') return responder(h, 200, await sesionDe(req, db, op))
    if (metodo === 'GET' && accion === 'invitaciones') return responder(h, 200, { demo: correo.demo, invitaciones: await listarInvitaciones(db, await sesionDe(req, db, op), op) })
    if (metodo === 'GET' && accion === 'invitacion') return responder(h, 200, await verInvitacion(db, url.searchParams.get('token'), op))
    if (!post) return responder(h, metodo === 'GET' ? 404 : 405, { error: 'Acción desconocida.' })
    const cuerpo = await leerCuerpo(req)
    switch (accion) {
      case 'registro':
        return responder(h, 201, await registrarEscuela(db, leerRegistro(cuerpo), op, escuelaDe(v)))
      case 'iniciar':
        return responder(h, 200, await iniciarSesion(db, cuerpo, op))
      case 'cerrar': {
        const t = tokenDe(req)
        if (t) await cerrarSesion(db, t, op)
        return responder(h, 200, { ok: true })
      }
      case 'perfil':
        return responder(h, 200, await cambiarPerfil(db, await sesionDe(req, db, op), cuerpo.perfilId, op))
      case 'recuperar': {
        // Misma respuesta exista o no el correo, y nunca con la liga (solo viaja por correo).
        await recuperar(db, cuerpo.correo, ligas, op)
        return responder(h, 200, { ok: true, demo: correo.demo, mensaje: 'Si el correo existe, recibirás una liga para restablecer tu contraseña.' })
      }
      case 'restablecer':
        return responder(h, 200, await restablecer(db, cuerpo, op))
      case 'invitar': {
        const sesion = await sesionDe(req, db, op)
        if (sesion.escuela.pruebaVencida) return responder(h, 402, { error: 'La prueba gratis de tu escuela terminó.', prueba: 'vencida' })
        return responder(h, 200, { correo: correo.nombre, demo: correo.demo, resultados: await invitar(db, sesion, leerPersonas(cuerpo), ligas, op) })
      }
      case 'reenviar': {
        const sesion = await sesionDe(req, db, op)
        if (sesion.escuela.pruebaVencida) return responder(h, 402, { error: 'La prueba gratis de tu escuela terminó.', prueba: 'vencida' })
        return responder(h, 200, { correo: correo.nombre, demo: correo.demo, resultado: await reenviarInvitacion(db, sesion, cuerpo.id, ligas, op) })
      }
      case 'aceptar':
        return responder(h, 200, await aceptarInvitacion(db, cuerpo, op))
      case 'prueba':
        return responder(h, 200, await simularPrueba(db, await sesionDe(req, db, op), cuerpo.accion, op))
      default:
        return responder(h, 404, { error: 'Acción desconocida.' })
    }
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
