import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import type { Consulta, Ejecutor } from './db.js'
import { asegurarEsquema, enContexto, enEscuela, insertarFilas } from './servicio.js'
import { NOMBRES_TABLAS, tablaSql } from './tablas.js'
import { mensajeConLiga, type AdaptadorCorreo } from './correo.js'
import { datosEscuelaNueva } from '../../src/data/escuelaNueva.js'
import {
  CONTRASENA_MINIMA,
  NOMBRE_PERFIL,
  type DatosRegistro,
  type InvitacionAdmin,
  type InvitacionPublica,
  type PerfilPublico,
  type PersonaInvitada,
  type ResultadoInvitacion,
  type SesionPublica,
  type TipoPerfil,
} from '../../src/data/cuentaTipos.js'
import type { Level } from '../../src/data/types'

/** Error con mensaje para la persona y su código HTTP. */
export class ErrorCuenta extends Error {
  readonly estado: number
  constructor(estado: number, mensaje: string) {
    super(mensaje)
    this.estado = estado
  }
}

const DIA = 86_400_000
export const DURACION_SESION_MS = 14 * DIA
export const DURACION_INVITACION_MS = 7 * DIA
export const DURACION_RECUPERACION_MS = 60 * 60 * 1000
export const DIAS_PRUEBA = 30

const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const normalizarCorreo = (c: unknown) => (typeof c === 'string' ? c.trim().toLowerCase() : '')
export const correoValido = (c: string) => c.length <= 254 && CORREO_RE.test(c)
const TIPOS: TipoPerfil[] = ['administrador', 'docente', 'familia', 'alumno']
const NIVELES: Level[] = ['maternal', 'kinder', 'primaria', 'secundaria', 'preparatoria']
export const esTipo = (t: unknown): t is TipoPerfil => typeof t === 'string' && (TIPOS as string[]).includes(t)

/** Columna de «perfiles» / «invitaciones» y tabla de datos de cada tipo de perfil. */
const REFERENCIA: Record<TipoPerfil, { columna: string; tabla: 'staff' | 'teachers' | 'guardians' | 'students' }> = {
  administrador: { columna: 'personal_id', tabla: 'staff' },
  docente: { columna: 'docente_id', tabla: 'teachers' },
  familia: { columna: 'tutor_id', tabla: 'guardians' },
  alumno: { columna: 'alumno_id', tabla: 'students' },
}

// ───────────── Contraseñas y tokens ─────────────

/**
 * Hash de contraseña con scrypt (incluido en Node, función lenta y que usa mucha
 * memoria, recomendada por OWASP igual que argon2 y bcrypt). Formato:
 * scrypt$N$r$p$sal$hash. La contraseña nunca se guarda ni viaja de regreso.
 */
const N = 1 << 15
const R = 8
const P = 1
const derivar = (contrasena: string, sal: Buffer, n: number, r: number, p: number) =>
  new Promise<Buffer>((ok, mal) => scrypt(contrasena.normalize('NFKC'), sal, 64, { N: n, r, p, maxmem: 256 * n * r }, (e, k) => (e ? mal(e) : ok(k))))

export async function hashContrasena(contrasena: string): Promise<string> {
  const sal = randomBytes(16)
  const k = await derivar(contrasena, sal, N, R, P)
  return `scrypt$${N}$${R}$${P}$${sal.toString('base64url')}$${k.toString('base64url')}`
}

export async function verificarContrasena(contrasena: string, hash: string | null | undefined): Promise<boolean> {
  const partes = (hash ?? '').split('$')
  if (partes.length !== 6 || partes[0] !== 'scrypt') {
    // Se calcula igual para que tarde lo mismo exista o no la cuenta.
    await derivar(contrasena, Buffer.alloc(16), N, R, P)
    return false
  }
  const [, n, r, p, sal, k] = partes
  const esperado = Buffer.from(k!, 'base64url')
  const calculado = await derivar(contrasena, Buffer.from(sal!, 'base64url'), Number(n), Number(r), Number(p))
  return esperado.length === calculado.length && timingSafeEqual(esperado, calculado)
}

/** Token de sesión, invitación o recuperación: «escuela.aleatorio». En la base solo se guarda su huella. */
const nuevoToken = (escuela: string) => `${escuela}.${randomBytes(32).toString('base64url')}`
export const huella = (token: string) => createHash('sha256').update(token).digest('hex')
const ESCUELA_RE = /^[a-z0-9][a-z0-9-]{0,62}$/
/** La escuela del token. Si alguien la cambia, la huella ya no coincide en esa escuela. */
export function escuelaDelToken(token: unknown): string | null {
  if (typeof token !== 'string' || token.length > 200) return null
  const i = token.indexOf('.')
  const e = token.slice(0, i)
  return i > 0 && ESCUELA_RE.test(e) && token.length - i > 20 ? e : null
}
const nuevoId = (prefijo: string) => `${prefijo}-${randomBytes(6).toString('hex')}`

export function validarContrasena(c: unknown): string {
  if (typeof c !== 'string' || c.length < CONTRASENA_MINIMA) throw new ErrorCuenta(400, `La contraseña debe tener al menos ${CONTRASENA_MINIMA} caracteres.`)
  if (c.length > 200) throw new ErrorCuenta(400, 'La contraseña es demasiado larga.')
  return c
}

// ───────────── Sesiones ─────────────

export interface Opciones {
  /** Fecha y hora del servidor (en pruebas se puede adelantar). */
  ahora: () => Date
  /** ¿Se puede simular el fin de la prueba? (solo desarrollo y vista previa) */
  puedeSimularPrueba: boolean
  contacto: string
}

const NOMBRE_FICHA = `case p.tipo
  when 'administrador' then (select f.data->>'name' from "staff" f where f.school_id = p.school_id and f.id = p.personal_id)
  when 'docente' then (select concat_ws(' ', f.data->>'firstName', f.data->>'lastName') from "teachers" f where f.school_id = p.school_id and f.id = p.docente_id)
  when 'familia' then (select concat_ws(' ', f.data->>'firstName', f.data->>'lastName') from "guardians" f where f.school_id = p.school_id and f.id = p.tutor_id)
  else (select concat_ws(' ', f.data->>'firstName', f.data->>'lastName') from "students" f where f.school_id = p.school_id and f.id = p.alumno_id)
end`

const ORDEN_PERFIL = `array_position(array['administrador','docente','familia','alumno'], p.tipo), p.created_at`

const aPerfil = (f: Record<string, unknown>): PerfilPublico => ({
  id: String(f.id),
  tipo: f.tipo as TipoPerfil,
  referencia: String(f.personal_id ?? f.docente_id ?? f.tutor_id ?? f.alumno_id ?? ''),
  nombre: String(f.nombre_ficha ?? ''),
})

const fecha = (v: unknown): Date => (v instanceof Date ? v : new Date(String(v)))

/** Lee una sesión vigente por su token. null si no existe, expiró o se cerró. */
export async function leerSesion(db: Ejecutor, token: string, op: Opciones): Promise<SesionPublica | null> {
  const escuela = escuelaDelToken(token)
  if (!escuela) return null
  await asegurarEsquema(db)
  const h = huella(token)
  const [s, perfiles, esc] = await enEscuela(db, escuela, [
    {
      text: `select s.id, s.perfil_id, s.expira_at, u.id as usuario_id, u.nombre, u.correo from "sesiones" s
join "usuarios" u on u.school_id = s.school_id and u.id = s.usuario_id
where s.school_id = $1 and s.token = $2 and s.cerrada_at is null and s.expira_at > $3 and u.estado = 'activo'`,
      params: [escuela, h, op.ahora()],
    },
    {
      text: `select p.*, ${NOMBRE_FICHA} as nombre_ficha from "perfiles" p
join "sesiones" s on s.school_id = p.school_id and s.usuario_id = p.usuario_id
where s.school_id = $1 and s.token = $2 order by ${ORDEN_PERFIL}`,
      params: [escuela, h],
    },
    { text: `select nombre, trial_ends_at from "escuelas" where school_id = $1`, params: [escuela] },
  ])
  const fila = s?.[0]
  const e = esc?.[0]
  if (!fila || !e) return null
  const lista = (perfiles ?? []).map(aPerfil)
  const fin = e.trial_ends_at ? fecha(e.trial_ends_at) : null
  const restante = fin ? fin.getTime() - op.ahora().getTime() : null
  return {
    token,
    expiraAt: fecha(fila.expira_at).toISOString(),
    usuario: { id: String(fila.usuario_id), nombre: String(fila.nombre), correo: String(fila.correo) },
    perfil: lista.find((p) => p.id === fila.perfil_id) ?? null,
    perfiles: lista,
    escuela: {
      id: escuela,
      nombre: String(e.nombre ?? ''),
      trialEndsAt: fin ? fin.toISOString() : null,
      diasRestantes: restante === null ? null : Math.max(0, Math.ceil(restante / DIA)),
      pruebaVencida: restante !== null && restante <= 0,
    },
    puedeSimularPrueba: op.puedeSimularPrueba,
    contacto: op.contacto,
  }
}

/** Consulta que abre una sesión nueva; devuelve el token para entregarlo una sola vez. */
function consultaSesion(escuela: string, usuarioId: string, perfilId: string | null, ahora: Date): { token: string; consulta: Consulta } {
  const token = nuevoToken(escuela)
  return {
    token,
    consulta: {
      text: `insert into "sesiones" (school_id, id, usuario_id, perfil_id, token, expira_at) values ($1, $2, $3, $4, $5, $6)`,
      params: [escuela, nuevoId('ses'), usuarioId, perfilId, huella(token), new Date(ahora.getTime() + DURACION_SESION_MS)],
    },
  }
}

async function sesionObligatoria(db: Ejecutor, token: string, op: Opciones): Promise<SesionPublica> {
  const s = await leerSesion(db, token, op)
  if (!s) throw new ErrorCuenta(500, 'No se pudo abrir la sesión.')
  return s
}

/** Primer perfil de la cuenta (administrador, docente, familia, alumno), para entrar directo. */
const PRIMER_PERFIL = `(select p.id from "perfiles" p where p.school_id = $1 and p.usuario_id = $2 order by ${ORDEN_PERFIL} limit 1)`

// ───────────── Iniciar y cerrar sesión ─────────────

export type ResultadoInicio = { sesion: SesionPublica } | { elegir: { id: string; nombre: string }[] }

/**
 * Inicia sesión con correo y contraseña. La consulta solo ve las cuentas con ese
 * correo (política RLS «por_correo»). Si el correo tiene cuenta en varias
 * escuelas con la misma contraseña, se pide elegir la escuela.
 */
export async function iniciarSesion(db: Ejecutor, cuerpo: { correo?: unknown; contrasena?: unknown; escuela?: unknown }, op: Opciones): Promise<ResultadoInicio> {
  const correo = normalizarCorreo(cuerpo.correo)
  const contrasena = typeof cuerpo.contrasena === 'string' ? cuerpo.contrasena : ''
  const incorrecto = new ErrorCuenta(401, 'El correo o la contraseña no son correctos.')
  if (!correoValido(correo) || !contrasena) throw incorrecto
  await asegurarEsquema(db)
  const [filas] = await enContexto(db, { 'edugrid.correo': correo }, [
    {
      text: `select u.school_id, u.id, u.hash_contrasena, e.nombre as escuela from "usuarios" u
join "escuelas" e on e.school_id = u.school_id
where u.correo = $1 and u.estado = 'activo' order by e.creada`,
      params: [correo],
    },
  ])
  const candidatas = filas ?? []
  if (candidatas.length === 0) {
    await verificarContrasena(contrasena, null)
    throw incorrecto
  }
  const buenas: Record<string, unknown>[] = []
  for (const f of candidatas) if (await verificarContrasena(contrasena, f.hash_contrasena as string)) buenas.push(f)
  const elegida = typeof cuerpo.escuela === 'string' ? buenas.filter((f) => f.school_id === cuerpo.escuela) : buenas
  if (elegida.length === 0) throw incorrecto
  if (elegida.length > 1) return { elegir: elegida.map((f) => ({ id: String(f.school_id), nombre: String(f.escuela ?? f.school_id) })) }
  const f = elegida[0]!
  const escuela = String(f.school_id)
  const ahora = op.ahora()
  const token = nuevoToken(escuela)
  await enEscuela(db, escuela, [
    {
      text: `insert into "sesiones" (school_id, id, usuario_id, perfil_id, token, expira_at) values ($1, $3, $2, ${PRIMER_PERFIL}, $4, $5)`,
      params: [escuela, String(f.id), nuevoId('ses'), huella(token), new Date(ahora.getTime() + DURACION_SESION_MS)],
    },
  ])
  return { sesion: await sesionObligatoria(db, token, op) }
}

export async function cerrarSesion(db: Ejecutor, token: string, op: Opciones): Promise<void> {
  const escuela = escuelaDelToken(token)
  if (!escuela) return
  await asegurarEsquema(db)
  await enEscuela(db, escuela, [
    { text: `update "sesiones" set cerrada_at = $3 where school_id = $1 and token = $2`, params: [escuela, huella(token), op.ahora()] },
  ])
}

/** Cambia el perfil con el que se usa la app (si la cuenta tiene varios). */
export async function cambiarPerfil(db: Ejecutor, sesion: SesionPublica, perfilId: unknown, op: Opciones): Promise<SesionPublica> {
  const p = sesion.perfiles.find((x) => x.id === perfilId)
  if (!p) throw new ErrorCuenta(404, 'Ese perfil no es de tu cuenta.')
  await enEscuela(db, sesion.escuela.id, [
    { text: `update "sesiones" set perfil_id = $3 where school_id = $1 and token = $2`, params: [sesion.escuela.id, huella(sesion.token), p.id] },
  ])
  return sesionObligatoria(db, sesion.token, op)
}

// ───────────── Alta de escuela (wizard) ─────────────

const slug = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '') || 'escuela'

export function leerRegistro(cuerpo: unknown): DatosRegistro {
  const c = (cuerpo ?? {}) as { escuela?: Record<string, unknown>; admin?: Record<string, unknown> }
  const nombre = typeof c.escuela?.nombre === 'string' ? c.escuela.nombre.trim() : ''
  const niveles = Array.isArray(c.escuela?.niveles) ? (c.escuela.niveles as unknown[]).filter((n): n is Level => (NIVELES as unknown[]).includes(n)) : []
  const correoContacto = normalizarCorreo(c.escuela?.correoContacto)
  const adminNombre = typeof c.admin?.nombre === 'string' ? c.admin.nombre.trim() : ''
  const adminCorreo = normalizarCorreo(c.admin?.correo)
  if (nombre.length < 3 || nombre.length > 120) throw new ErrorCuenta(400, 'Escribe el nombre de la escuela (de 3 a 120 caracteres).')
  if (niveles.length === 0) throw new ErrorCuenta(400, 'Elige al menos un nivel que atiende la escuela.')
  if (!correoValido(correoContacto)) throw new ErrorCuenta(400, 'El correo de contacto de la escuela no tiene un formato válido.')
  if (adminNombre.length < 3 || adminNombre.length > 120) throw new ErrorCuenta(400, 'Escribe el nombre del administrador.')
  if (!correoValido(adminCorreo)) throw new ErrorCuenta(400, 'El correo del administrador no tiene un formato válido.')
  return { escuela: { nombre, niveles: [...new Set(niveles)], correoContacto }, admin: { nombre: adminNombre, correo: adminCorreo, contrasena: validarContrasena(c.admin?.contrasena) } }
}

/**
 * Crea la escuela con sus datos iniciales, la cuenta del administrador (activa) y
 * su sesión, todo en una sola transacción. La prueba gratis vence en 30 días.
 */
export async function registrarEscuela(db: Ejecutor, d: DatosRegistro, op: Opciones, escuelaDemo: string): Promise<SesionPublica> {
  await asegurarEsquema(db)
  let escuela = `${slug(d.escuela.nombre)}-${randomBytes(3).toString('hex')}`
  if (escuela === escuelaDemo) escuela = `${escuela}-1`
  const ahora = op.ahora()
  const adminId = nuevoId('adm')
  const usuarioId = nuevoId('usr')
  const perfilId = nuevoId('pf')
  const datos = datosEscuelaNueva({ id: escuela, nombre: d.escuela.nombre, niveles: d.escuela.niveles, correoContacto: d.escuela.correoContacto, admin: { id: adminId, nombre: d.admin.nombre, correo: d.admin.correo }, hoy: ahora })
  const hash = await hashContrasena(d.admin.contrasena)
  const ses = consultaSesion(escuela, usuarioId, perfilId, ahora)
  const consultas: Consulta[] = [
    {
      text: `insert into "escuelas" (school_id, data, nombre, niveles, trial_ends_at) values ($1, $2::jsonb, $3, $4, $5)`,
      params: [escuela, JSON.stringify(datos.meta), d.escuela.nombre, d.escuela.niveles, new Date(ahora.getTime() + DIAS_PRUEBA * DIA)],
    },
    ...NOMBRES_TABLAS.filter((t) => (datos[t] as unknown[]).length).map((t) => insertarFilas(escuela, t, datos[t] as unknown[])),
    {
      text: `insert into "usuarios" (school_id, id, correo, hash_contrasena, nombre, estado) values ($1, $2, $3, $4, $5, 'activo')`,
      params: [escuela, usuarioId, d.admin.correo, hash, d.admin.nombre],
    },
    { text: `insert into "perfiles" (school_id, id, usuario_id, tipo, personal_id) values ($1, $2, $3, 'administrador', $4)`, params: [escuela, perfilId, usuarioId, adminId] },
    ses.consulta,
  ]
  await enEscuela(db, escuela, consultas)
  return sesionObligatoria(db, ses.token, op)
}

/** Solo desarrollo y vista previa: vence la prueba ahora o la regresa a 30 días. */
export async function simularPrueba(db: Ejecutor, sesion: SesionPublica, accion: unknown, op: Opciones): Promise<SesionPublica> {
  if (!op.puedeSimularPrueba) throw new ErrorCuenta(403, 'Simular la prueba solo se puede en desarrollo o en la vista previa.')
  if (sesion.perfil?.tipo !== 'administrador') throw new ErrorCuenta(403, 'Solo el administrador puede hacerlo.')
  if (accion !== 'vencer' && accion !== 'reiniciar') throw new ErrorCuenta(400, 'Acción desconocida.')
  const ahora = op.ahora().getTime()
  const fin = accion === 'vencer' ? new Date(ahora - 60_000) : new Date(ahora + DIAS_PRUEBA * DIA)
  await enEscuela(db, sesion.escuela.id, [{ text: `update "escuelas" set trial_ends_at = $2 where school_id = $1`, params: [sesion.escuela.id, fin] }])
  return sesionObligatoria(db, sesion.token, op)
}

// ───────────── Invitaciones ─────────────

export interface Ligas {
  /** Dirección de la app, por ejemplo https://edugrid.vercel.app */
  app: string
  correo: AdaptadorCorreo
  /** ¿Se devuelven las ligas a la pantalla? Solo con correo demo y fuera de producción. */
  mostrar: boolean
}

const ligaInvitacion = (l: Ligas, token: string) => `${l.app}/#/invitacion/${encodeURIComponent(token)}`
const ligaRecuperacion = (l: Ligas, token: string) => `${l.app}/#/restablecer/${encodeURIComponent(token)}`

export function leerPersonas(cuerpo: unknown): PersonaInvitada[] {
  const lista = (cuerpo as { personas?: unknown })?.personas
  if (!Array.isArray(lista) || lista.length === 0 || lista.length > 200) throw new ErrorCuenta(400, 'Envía de 1 a 200 personas por invitación.')
  return lista.map((p) => {
    const x = (p ?? {}) as Record<string, unknown>
    if (!esTipo(x.tipo)) throw new ErrorCuenta(400, 'Tipo de perfil desconocido.')
    if (typeof x.referencia !== 'string' || !x.referencia) throw new ErrorCuenta(400, 'Falta la ficha de la persona.')
    return { tipo: x.tipo, referencia: x.referencia, correo: normalizarCorreo(x.correo), nombre: typeof x.nombre === 'string' ? x.nombre.trim().slice(0, 120) : '' }
  })
}

/** Perfil que da una invitación: el principal (columnas) o uno de «extra». */
type PerfilInv = { tipo: TipoPerfil; ref: string }
const clavePerfil = (p: PerfilInv) => `${p.tipo}|${p.ref}`
const extraDe = (v: unknown): PerfilInv[] => {
  const lista = typeof v === 'string' ? (JSON.parse(v) as unknown) : v
  return Array.isArray(lista) ? lista.filter((x): x is PerfilInv => !!x && esTipo((x as PerfilInv).tipo) && typeof (x as PerfilInv).ref === 'string') : []
}
const perfilesDeFila = (f: Record<string, unknown>): PerfilInv[] => [
  { tipo: f.tipo as TipoPerfil, ref: String(f[REFERENCIA[f.tipo as TipoPerfil].columna] ?? '') },
  ...extraDe(f.extra),
]

/** Correo de invitación con todos los perfiles que da (por ejemplo familia y alumno). */
function mensajeInvitacion(escuelaNombre: string, correo: string, nombre: string, perfiles: PerfilInv[], liga: string) {
  const tipos = [...new Set(perfiles.map((p) => p.tipo))]
  const nombres = tipos.map((t) => NOMBRE_PERFIL[t].toLowerCase())
  const lista = nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : nombres[0]
  const alumnos = perfiles.filter((p) => p.tipo === 'alumno').length
  const extra = [
    ...(tipos.includes('familia') ? ['Con tu cuenta de familia verás a todos tus hijos inscritos en la escuela.'] : []),
    ...(alumnos
      ? [alumnos > 1 || tipos.includes('familia')
          ? 'La misma cuenta incluye el perfil de alumno de tus hijos: desde ahí ves su horario, tareas y calificaciones.'
          : 'Es la cuenta de alumno de la persona inscrita. Si el alumno es menor de edad, la madre, padre o tutor puede abrirla y ver su horario, tareas y calificaciones.']
      : []),
  ]
  return mensajeConLiga({
    para: correo,
    asunto: `${escuelaNombre} te invita a EDUGRID`,
    saludo: `Hola${nombre && nombre !== correo ? `, ${nombre}` : ''}:`,
    parrafos: [`${escuelaNombre} te dio de alta en EDUGRID con ${tipos.length > 1 ? 'los perfiles' : 'el perfil'} de ${lista}.`, ...extra, 'Abre la liga para crear tu contraseña y entrar. Si ya tienes cuenta en esta escuela con este correo, solo se agregan los perfiles nuevos.'],
    boton: 'Crear mi contraseña',
    liga,
    pie: 'La liga vence en 7 días y solo se puede usar una vez. Si no esperabas este correo, puedes ignorarlo.',
  })
}

/**
 * Crea las invitaciones de una escuela y manda los correos.
 * UNA invitación por correo en cada escuela: si el correo ya tiene una invitación
 * pendiente (como familia, alumno o docente), el perfil nuevo se agrega a esa misma
 * invitación y no se crea otra. Si la pendiente ya venció, se renueva con una liga nueva.
 * Si la persona no tiene cuenta, se crea en estado «invitado»; si ya tiene ese perfil, no se invita.
 * Solo el administrador puede invitar, y solo a fichas que existen en SU escuela.
 */
export async function invitar(db: Ejecutor, sesion: SesionPublica, personas: PersonaInvitada[], ligas: Ligas, op: Opciones): Promise<ResultadoInvitacion[]> {
  if (sesion.perfil?.tipo !== 'administrador') throw new ErrorCuenta(403, 'Solo el administrador puede enviar invitaciones.')
  const escuela = sesion.escuela.id
  const porTabla = new Map<string, string[]>()
  for (const p of personas) porTabla.set(REFERENCIA[p.tipo].tabla, [...(porTabla.get(REFERENCIA[p.tipo].tabla) ?? []), p.referencia])
  const tablas = [...porTabla.keys()]
  const correos = [...new Set(personas.map((p) => p.correo))]
  const ahora = op.ahora()
  const r = await enEscuela(db, escuela, [
    ...tablas.map((t) => ({ text: `select id from ${tablaSql(t as 'staff')} where school_id = $1 and id = any($2::text[])`, params: [escuela, porTabla.get(t)] })),
    {
      text: `select u.correo, p.tipo, coalesce(p.personal_id, p.docente_id, p.tutor_id, p.alumno_id) as ref from "perfiles" p
join "usuarios" u on u.school_id = p.school_id and u.id = p.usuario_id where p.school_id = $1 and u.correo = any($2::text[])`,
      params: [escuela, correos],
    },
    {
      text: `select * from "invitaciones" where school_id = $1 and correo = any($2::text[]) and usada_at is null order by created_at`,
      params: [escuela, correos],
    },
  ])
  const existen = new Set<string>()
  tablas.forEach((t, i) => (r[i] ?? []).forEach((f) => existen.add(`${t}:${String(f.id)}`)))
  const yaTiene = new Set((r[tablas.length] ?? []).map((f) => `${String(f.correo)}|${String(f.tipo)}|${String(f.ref)}`))

  // La invitación pendiente de cada correo (la más antigua, si hubiera varias de antes de esta versión).
  interface Inv { id: string; correo: string; nombre: string; nueva: boolean; principal: PerfilInv; extra: PerfilInv[]; cubre: Set<string>; vencida: boolean; cambio: boolean; token?: string; resultado?: number }
  const porCorreo = new Map<string, Inv>()
  for (const f of r[tablas.length + 1] ?? []) {
    const correo = String(f.correo)
    const perfiles = perfilesDeFila(f)
    const ya = porCorreo.get(correo)
    if (ya) {
      perfiles.forEach((p) => ya.cubre.add(clavePerfil(p)))
      continue
    }
    porCorreo.set(correo, {
      id: String(f.id), correo, nombre: String(f.nombre), nueva: false, principal: perfiles[0]!, extra: perfiles.slice(1),
      cubre: new Set(perfiles.map(clavePerfil)), vencida: fecha(f.expira_at).getTime() <= ahora.getTime(), cambio: false,
    })
  }

  const resultados: ResultadoInvitacion[] = []
  for (const p of personas) {
    if (!correoValido(p.correo)) {
      resultados.push({ ...p, estado: 'error', motivo: 'El correo no tiene un formato válido.' })
      continue
    }
    if (!existen.has(`${REFERENCIA[p.tipo].tabla}:${p.referencia}`)) {
      resultados.push({ ...p, estado: 'error', motivo: 'La ficha no existe en esta escuela.' })
      continue
    }
    if (yaTiene.has(`${p.correo}|${p.tipo}|${p.referencia}`)) {
      resultados.push({ ...p, estado: 'ya-tiene-perfil', motivo: 'Ese correo ya entra con este perfil.' })
      continue
    }
    const perfil: PerfilInv = { tipo: p.tipo, ref: p.referencia }
    const inv = porCorreo.get(p.correo)
    if (!inv) {
      porCorreo.set(p.correo, { id: nuevoId('inv'), correo: p.correo, nombre: p.nombre || p.correo, nueva: true, principal: perfil, extra: [], cubre: new Set([clavePerfil(perfil)]), vencida: false, cambio: true, resultado: resultados.length })
      resultados.push({ ...p, estado: 'no-enviada' })
      continue
    }
    if (!inv.cubre.has(clavePerfil(perfil))) {
      inv.cubre.add(clavePerfil(perfil))
      inv.extra.push(perfil)
      inv.cambio = true
    }
    // Una invitación vencida se renueva (liga nueva y 7 días más) y se vuelve a mandar.
    if (inv.vencida && inv.resultado === undefined) {
      inv.cambio = true
      inv.resultado = resultados.length
      resultados.push({ ...p, estado: 'no-enviada' })
      continue
    }
    resultados.push({
      ...p,
      estado: 'reutilizada',
      motivo: inv.nueva || inv.resultado !== undefined
        ? `Va en la misma invitación de ${p.correo}: un solo correo para todos sus perfiles.`
        : `${p.correo} ya tenía una invitación pendiente: se agregó este perfil a la misma liga, no se creó otra.`,
    })
  }

  const expira = new Date(ahora.getTime() + DURACION_INVITACION_MS)
  const consultas: Consulta[] = []
  const envios: Inv[] = []
  for (const inv of porCorreo.values()) {
    if (!inv.cambio) continue
    const extra = JSON.stringify(inv.extra)
    if (inv.nueva) {
      inv.token = nuevoToken(escuela)
      consultas.push(
        {
          text: `insert into "usuarios" (school_id, id, correo, nombre, estado) values ($1, $2, $3, $4, 'invitado') on conflict (school_id, correo) do nothing`,
          params: [escuela, nuevoId('usr'), inv.correo, inv.nombre],
        },
        {
          text: `insert into "invitaciones" (school_id, id, correo, nombre, tipo, ${REFERENCIA[inv.principal.tipo].columna}, token, expira_at, extra) values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
          params: [escuela, inv.id, inv.correo, inv.nombre, inv.principal.tipo, inv.principal.ref, huella(inv.token), expira, extra],
        },
      )
    } else if (inv.vencida) {
      inv.token = nuevoToken(escuela)
      consultas.push({ text: `update "invitaciones" set extra = $3::jsonb, token = $4, expira_at = $5 where school_id = $1 and id = $2 and usada_at is null`, params: [escuela, inv.id, extra, huella(inv.token), expira] })
    } else consultas.push({ text: `update "invitaciones" set extra = $3::jsonb where school_id = $1 and id = $2 and usada_at is null`, params: [escuela, inv.id, extra] })
    if (inv.token) envios.push(inv)
  }
  if (consultas.length) await enEscuela(db, escuela, consultas)

  const mensajes = envios.map((inv) => mensajeInvitacion(sesion.escuela.nombre, inv.correo, inv.nombre, [inv.principal, ...inv.extra], ligaInvitacion(ligas, inv.token!)))
  const enviados = mensajes.length ? await ligas.correo.enviar(mensajes) : []
  envios.forEach((inv, k) => {
    if (inv.resultado === undefined) return
    const e = enviados[k]
    const r0 = resultados[inv.resultado]!
    r0.estado = e?.enviado ? 'enviada' : 'no-enviada'
    if (!e?.enviado) r0.motivo = e?.motivo ?? 'No se envió el correo.'
    if (ligas.mostrar) r0.liga = ligaInvitacion(ligas, inv.token!)
  })
  return resultados
}

/** Invitaciones de la escuela con su estado, para las listas de Alumnos, Docentes y Familias. */
export async function listarInvitaciones(db: Ejecutor, sesion: SesionPublica, op: Opciones): Promise<InvitacionAdmin[]> {
  if (sesion.perfil?.tipo !== 'administrador') throw new ErrorCuenta(403, 'Solo el administrador puede ver las invitaciones.')
  const escuela = sesion.escuela.id
  const [filas] = await enEscuela(db, escuela, [
    { text: `select * from "invitaciones" where school_id = $1 order by created_at desc limit 2000`, params: [escuela] },
  ])
  const ahora = op.ahora().getTime()
  return (filas ?? []).map((f) => ({
    id: String(f.id),
    correo: String(f.correo),
    nombre: String(f.nombre),
    perfiles: perfilesDeFila(f).map((p) => ({ tipo: p.tipo, referencia: p.ref })),
    estado: f.usada_at ? 'aceptada' : fecha(f.expira_at).getTime() <= ahora ? 'expirada' : 'pendiente',
    creadaAt: fecha(f.created_at).toISOString(),
    expiraAt: fecha(f.expira_at).toISOString(),
    aceptadaAt: f.usada_at ? fecha(f.usada_at).toISOString() : null,
  }))
}

/** Reenvía una invitación pendiente o vencida: liga nueva (la anterior deja de servir) y 7 días más. */
export async function reenviarInvitacion(db: Ejecutor, sesion: SesionPublica, id: unknown, ligas: Ligas, op: Opciones): Promise<ResultadoInvitacion> {
  if (sesion.perfil?.tipo !== 'administrador') throw new ErrorCuenta(403, 'Solo el administrador puede enviar invitaciones.')
  if (typeof id !== 'string' || !id) throw new ErrorCuenta(400, 'Falta la invitación.')
  const escuela = sesion.escuela.id
  const [filas] = await enEscuela(db, escuela, [{ text: `select * from "invitaciones" where school_id = $1 and id = $2`, params: [escuela, id] }])
  const f = filas?.[0]
  if (!f) throw new ErrorCuenta(404, 'Esa invitación no existe en tu escuela.')
  if (f.usada_at) throw new ErrorCuenta(409, 'Esa invitación ya se aceptó.')
  const token = nuevoToken(escuela)
  await enEscuela(db, escuela, [
    { text: `update "invitaciones" set token = $3, expira_at = $4 where school_id = $1 and id = $2 and usada_at is null`, params: [escuela, id, huella(token), new Date(op.ahora().getTime() + DURACION_INVITACION_MS)] },
  ])
  const perfiles = perfilesDeFila(f)
  const [e] = await ligas.correo.enviar([mensajeInvitacion(sesion.escuela.nombre, String(f.correo), String(f.nombre), perfiles, ligaInvitacion(ligas, token))])
  return {
    tipo: perfiles[0]!.tipo,
    referencia: perfiles[0]!.ref,
    correo: String(f.correo),
    nombre: String(f.nombre),
    estado: e?.enviado ? 'enviada' : 'no-enviada',
    ...(e?.enviado ? {} : { motivo: e?.motivo ?? 'No se envió el correo.' }),
    ...(ligas.mostrar ? { liga: ligaInvitacion(ligas, token) } : {}),
  }
}

async function buscarInvitacion(db: Ejecutor, token: unknown, op: Opciones) {
  const escuela = escuelaDelToken(token)
  if (!escuela) throw new ErrorCuenta(404, 'La liga de invitación no es válida.')
  await asegurarEsquema(db)
  const [inv, esc] = await enEscuela(db, escuela, [
    {
      text: `select i.*, u.estado as estado_usuario, u.id as usuario_id from "invitaciones" i
left join "usuarios" u on u.school_id = i.school_id and u.correo = i.correo
where i.school_id = $1 and i.token = $2`,
      params: [escuela, huella(String(token))],
    },
    { text: `select nombre from "escuelas" where school_id = $1`, params: [escuela] },
  ])
  const f = inv?.[0]
  if (!f) throw new ErrorCuenta(404, 'La liga de invitación no es válida.')
  const estado: InvitacionPublica['estado'] = f.usada_at ? 'usada' : fecha(f.expira_at).getTime() <= op.ahora().getTime() ? 'vencida' : 'vigente'
  return { escuela, fila: f, publica: { escuela: String(esc?.[0]?.nombre ?? ''), nombre: String(f.nombre), correo: String(f.correo), tipo: f.tipo as TipoPerfil, cuentaActiva: f.estado_usuario === 'activo', estado } satisfies InvitacionPublica }
}

export async function verInvitacion(db: Ejecutor, token: unknown, op: Opciones): Promise<InvitacionPublica> {
  return (await buscarInvitacion(db, token, op)).publica
}

/**
 * La persona abre la liga y crea su contraseña (o, si ya tiene cuenta en esa
 * escuela, escribe la que ya tiene). Queda vinculada a su perfil y entra.
 */
export async function aceptarInvitacion(db: Ejecutor, cuerpo: { token?: unknown; contrasena?: unknown }, op: Opciones): Promise<SesionPublica> {
  const { escuela, fila, publica } = await buscarInvitacion(db, cuerpo.token, op)
  if (publica.estado === 'usada') throw new ErrorCuenta(410, 'Esta invitación ya se usó. Entra con tu correo y contraseña.')
  if (publica.estado === 'vencida') throw new ErrorCuenta(410, 'Esta invitación ya venció. Pide a la escuela que te la envíe de nuevo.')
  const ahora = op.ahora()
  const consultas: Consulta[] = []
  let usuarioId = fila.usuario_id ? String(fila.usuario_id) : nuevoId('usr')
  if (publica.cuentaActiva) {
    const [u] = await enEscuela(db, escuela, [{ text: `select hash_contrasena from "usuarios" where school_id = $1 and id = $2`, params: [escuela, usuarioId] }])
    if (!(await verificarContrasena(String(cuerpo.contrasena ?? ''), u?.[0]?.hash_contrasena as string)))
      throw new ErrorCuenta(401, 'Ese correo ya tiene cuenta en esta escuela: escribe la contraseña que ya usas.')
  } else {
    const hash = await hashContrasena(validarContrasena(cuerpo.contrasena))
    if (fila.usuario_id) consultas.push({ text: `update "usuarios" set hash_contrasena = $3, estado = 'activo' where school_id = $1 and id = $2`, params: [escuela, usuarioId, hash] })
    else {
      usuarioId = nuevoId('usr')
      consultas.push({
        text: `insert into "usuarios" (school_id, id, correo, hash_contrasena, nombre, estado) values ($1, $2, $3, $4, $5, 'activo')`,
        params: [escuela, usuarioId, publica.correo, hash, publica.nombre],
      })
    }
  }
  const tipo = publica.tipo
  const col = REFERENCIA[tipo].columna
  const ref = String(fila[col])
  const perfilId = nuevoId('pf')
  const token = nuevoToken(escuela)
  consultas.push(
    {
      text: `insert into "perfiles" (school_id, id, usuario_id, tipo, ${col}) values ($1, $2, $3, $4, $5) on conflict do nothing`,
      params: [escuela, perfilId, usuarioId, tipo, ref],
    },
    // Los perfiles adicionales de la invitación (por ejemplo, los hijos como alumnos en la invitación de la mamá).
    {
      text: `insert into "perfiles" (school_id, id, usuario_id, tipo, personal_id, docente_id, alumno_id, tutor_id)
select i.school_id, 'pf-' || substr(md5(random()::text || i.id || e.value::text), 1, 12), $3, e.value->>'tipo',
  case when e.value->>'tipo' = 'administrador' then e.value->>'ref' end,
  case when e.value->>'tipo' = 'docente' then e.value->>'ref' end,
  case when e.value->>'tipo' = 'alumno' then e.value->>'ref' end,
  case when e.value->>'tipo' = 'familia' then e.value->>'ref' end
from "invitaciones" i cross join lateral jsonb_array_elements(i.extra) e
where i.school_id = $1 and i.correo = $2 and i.usada_at is null and i.expira_at > $4
on conflict do nothing`,
      params: [escuela, publica.correo, usuarioId, ahora],
    },
    // Las demás invitaciones vigentes para el mismo correo (por ejemplo, familia y alumnos
    // de una misma madre) se aceptan juntas: es la misma persona, no tiene que abrir cada liga.
    {
      text: `insert into "perfiles" (school_id, id, usuario_id, tipo, personal_id, docente_id, alumno_id, tutor_id)
select i.school_id, 'pf-' || substr(md5(random()::text || i.id), 1, 12), $3, i.tipo, i.personal_id, i.docente_id, i.alumno_id, i.tutor_id
from "invitaciones" i where i.school_id = $1 and i.correo = $2 and i.usada_at is null and i.expira_at > $4 and i.id <> $5
on conflict do nothing`,
      params: [escuela, publica.correo, usuarioId, ahora, String(fila.id)],
    },
    {
      text: `update "invitaciones" set usada_at = $3 where school_id = $1 and correo = $2 and usada_at is null and expira_at > $3 and id <> $4`,
      params: [escuela, publica.correo, ahora, String(fila.id)],
    },
    {
      text: `with u as (update "invitaciones" set usada_at = $3 where school_id = $1 and id = $2 and usada_at is null returning 1)
select edugrid_exigir(count(*), 'Esta invitación ya se usó.') from u`,
      params: [escuela, String(fila.id), ahora],
    },
    // Entra con el perfil de la invitación (el que ya existía si lo tenía repetido).
    {
      text: `insert into "sesiones" (school_id, id, usuario_id, perfil_id, token, expira_at)
values ($1, $2, $3, (select p.id from "perfiles" p where p.school_id = $1 and p.usuario_id = $3 and p.tipo = $4 and p.${col} = $5 limit 1), $6, $7)`,
      params: [escuela, nuevoId('ses'), usuarioId, tipo, ref, huella(token), new Date(ahora.getTime() + DURACION_SESION_MS)],
    },
  )
  await enEscuela(db, escuela, consultas)
  return sesionObligatoria(db, token, op)
}

// ───────────── Recuperar contraseña ─────────────

/**
 * Manda la liga para crear una contraseña nueva a cada escuela donde ese correo
 * tiene cuenta. Responde igual exista o no la cuenta (no revela quién está registrado).
 */
export async function recuperar(db: Ejecutor, correoBruto: unknown, ligas: Ligas, op: Opciones): Promise<void> {
  const correo = normalizarCorreo(correoBruto)
  if (!correoValido(correo)) throw new ErrorCuenta(400, 'Escribe un correo con formato válido.')
  await asegurarEsquema(db)
  const [cuentas] = await enContexto(db, { 'edugrid.correo': correo }, [
    {
      text: `select u.school_id, u.id, u.nombre, e.nombre as escuela from "usuarios" u join "escuelas" e on e.school_id = u.school_id where u.correo = $1 and u.estado = 'activo'`,
      params: [correo],
    },
  ])
  const ahora = op.ahora()
  const mensajes = []
  for (const c of cuentas ?? []) {
    const escuela = String(c.school_id)
    const token = nuevoToken(escuela)
    await enEscuela(db, escuela, [
      // Solo sirve la liga más reciente: las anteriores sin usar se anulan.
      { text: `update "recuperaciones" set usada_at = $3 where school_id = $1 and usuario_id = $2 and usada_at is null`, params: [escuela, String(c.id), ahora] },
      {
        text: `insert into "recuperaciones" (school_id, id, usuario_id, token, expira_at) values ($1, $2, $3, $4, $5)`,
        params: [escuela, nuevoId('rec'), String(c.id), huella(token), new Date(ahora.getTime() + DURACION_RECUPERACION_MS)],
      },
    ])
    // La liga va SOLO en el correo: nunca se devuelve a la pantalla (ni en modo demo).
    const liga = ligaRecuperacion(ligas, token)
    mensajes.push(
      mensajeConLiga({
        para: correo,
        asunto: `Crea una contraseña nueva para ${String(c.escuela)}`,
        saludo: `Hola, ${String(c.nombre)}:`,
        parrafos: [`Pediste crear una contraseña nueva para entrar a ${String(c.escuela)} en EDUGRID.`],
        boton: 'Crear contraseña nueva',
        liga,
        pie: 'La liga vence en 1 hora y solo se puede usar una vez. Si no fuiste tú, ignora este correo: tu contraseña no cambia.',
      }),
    )
  }
  if (mensajes.length) await ligas.correo.enviar(mensajes)
}

/** Con la liga de recuperación: pone la contraseña nueva, cierra las demás sesiones y entra. */
export async function restablecer(db: Ejecutor, cuerpo: { token?: unknown; contrasena?: unknown }, op: Opciones): Promise<SesionPublica> {
  const escuela = escuelaDelToken(cuerpo.token)
  const invalida = new ErrorCuenta(410, 'La liga para crear una contraseña nueva no es válida o ya venció. Pide otra.')
  if (!escuela) throw invalida
  const contrasena = validarContrasena(cuerpo.contrasena)
  await asegurarEsquema(db)
  const ahora = op.ahora()
  const [rec] = await enEscuela(db, escuela, [
    { text: `select id, usuario_id from "recuperaciones" where school_id = $1 and token = $2 and usada_at is null and expira_at > $3`, params: [escuela, huella(String(cuerpo.token)), ahora] },
  ])
  const f = rec?.[0]
  if (!f) throw invalida
  const usuarioId = String(f.usuario_id)
  const hash = await hashContrasena(contrasena)
  const ses = nuevoToken(escuela)
  await enEscuela(db, escuela, [
    { text: `update "usuarios" set hash_contrasena = $3, estado = 'activo' where school_id = $1 and id = $2`, params: [escuela, usuarioId, hash] },
    { text: `update "recuperaciones" set usada_at = $3 where school_id = $1 and id = $2`, params: [escuela, String(f.id), ahora] },
    { text: `update "sesiones" set cerrada_at = $3 where school_id = $1 and usuario_id = $2 and cerrada_at is null`, params: [escuela, usuarioId, ahora] },
    {
      text: `insert into "sesiones" (school_id, id, usuario_id, perfil_id, token, expira_at) values ($1, $3, $2, ${PRIMER_PERFIL}, $4, $5)`,
      params: [escuela, usuarioId, nuevoId('ses'), huella(ses), new Date(ahora.getTime() + DURACION_SESION_MS)],
    },
  ])
  return sesionObligatoria(db, ses, op)
}
