import type { Level, Role } from './types'

/** Perfiles de una cuenta, como se guardan en la tabla «perfiles». */
export type TipoPerfil = 'administrador' | 'docente' | 'familia' | 'alumno'

export const ROL_DE_PERFIL: Record<TipoPerfil, Role> = { administrador: 'admin', docente: 'docente', familia: 'familia', alumno: 'alumno' }
export const PERFIL_DE_ROL: Record<Role, TipoPerfil> = { admin: 'administrador', docente: 'docente', familia: 'familia', alumno: 'alumno' }
export const NOMBRE_PERFIL: Record<TipoPerfil, string> = { administrador: 'Administrador', docente: 'Docente', familia: 'Familia', alumno: 'Alumno' }

export interface PerfilPublico {
  id: string
  tipo: TipoPerfil
  /** Id de la ficha que representa: personal (staff), docente, tutor o alumno. */
  referencia: string
  /** Nombre de la ficha (por ejemplo, el nombre del alumno). */
  nombre: string
}

/** Lo que la API entrega de una sesión iniciada. Nunca incluye contraseñas ni huellas. */
export interface SesionPublica {
  token: string
  expiraAt: string
  usuario: { id: string; nombre: string; correo: string }
  /** Perfil con el que se está usando la app. */
  perfil: PerfilPublico | null
  perfiles: PerfilPublico[]
  escuela: { id: string; nombre: string; trialEndsAt: string | null; diasRestantes: number | null; pruebaVencida: boolean }
  /** Solo en desarrollo o vista previa: botón para simular el fin de la prueba. */
  puedeSimularPrueba: boolean
  /** Contacto para contratar cuando termina la prueba (correo o liga). */
  contacto: string
}

export interface DatosRegistro {
  escuela: { nombre: string; niveles: Level[]; correoContacto: string }
  admin: { nombre: string; correo: string; contrasena: string }
}

/** Persona a la que se le manda invitación. */
export interface PersonaInvitada {
  tipo: TipoPerfil
  referencia: string
  correo: string
  nombre: string
}

export interface ResultadoInvitacion extends PersonaInvitada {
  /** «reutilizada»: ese correo ya tenía invitación pendiente; el perfil se agregó a la misma (no se creó otra). */
  estado: 'enviada' | 'no-enviada' | 'reutilizada' | 'ya-tiene-perfil' | 'error'
  motivo?: string
  /** Solo en modo demo (sin RESEND_API_KEY y fuera de producción): la liga para probar. */
  liga?: string
}

/** Invitación como la ve el administrador en la lista de cada módulo. */
export interface InvitacionAdmin {
  id: string
  correo: string
  nombre: string
  /** Perfiles que da esta invitación (uno o varios: familia + alumnos con el mismo correo). */
  perfiles: { tipo: TipoPerfil; referencia: string }[]
  estado: 'pendiente' | 'aceptada' | 'expirada'
  creadaAt: string
  expiraAt: string
  aceptadaAt: string | null
}

export interface InvitacionPublica {
  escuela: string
  nombre: string
  correo: string
  tipo: TipoPerfil
  /** ¿Ese correo ya tiene cuenta activa en la escuela? Entonces solo se agrega el perfil. */
  cuentaActiva: boolean
  estado: 'vigente' | 'usada' | 'vencida'
}

export const CONTRASENA_MINIMA = 8
