import { apiUrl } from './apiAdapter'
import type { DatosRegistro, InvitacionAdmin, InvitacionPublica, PersonaInvitada, ResultadoInvitacion, SesionPublica } from './cuentaTipos'

/**
 * Cliente de /api/cuenta: inicio de sesión real, alta de escuela e invitaciones.
 * Las contraseñas viajan solo a la API (por HTTPS) y nunca se guardan en el navegador;
 * aquí solo queda el token de la sesión.
 */
const CLAVE = 'edugrid.sesion'

export class ErrorApi extends Error {
  readonly estado: number
  constructor(estado: number, mensaje: string) {
    super(mensaje)
    this.estado = estado
  }
}

/** ¿Hay servidor? En GitHub Pages no: ahí solo existe la demo en el navegador. */
export const hayServidor = () => apiUrl() !== ''

async function pedir<T>(accion: string, o: { cuerpo?: unknown; token?: string; query?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (o.token) headers.authorization = `Bearer ${o.token}`
  let res: Response
  try {
    res = await fetch(`${apiUrl().replace(/\/+$/, '')}/cuenta/${accion}${o.query ?? ''}`, o.cuerpo === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(o.cuerpo) })
  } catch {
    throw new ErrorApi(0, 'Sin conexión con el servidor de EDUGRID. Revisa tu internet e intenta de nuevo.')
  }
  const cuerpo = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) throw new ErrorApi(res.status, cuerpo?.error ?? `El servidor respondió con error ${res.status}.`)
  return cuerpo as T
}

export const cuentaApi = {
  registrar: (d: DatosRegistro) => pedir<SesionPublica>('registro', { cuerpo: d }),
  iniciar: (correo: string, contrasena: string, escuela?: string) =>
    pedir<{ sesion: SesionPublica } | { elegir: { id: string; nombre: string }[] }>('iniciar', { cuerpo: { correo, contrasena, escuela } }),
  cerrar: (token: string) => pedir<{ ok: true }>('cerrar', { cuerpo: {}, token }),
  sesion: (token: string) => pedir<SesionPublica>('sesion', { token }),
  perfil: (token: string, perfilId: string) => pedir<SesionPublica>('perfil', { cuerpo: { perfilId }, token }),
  recuperar: (correo: string) => pedir<{ mensaje: string; demo: boolean }>('recuperar', { cuerpo: { correo } }),
  restablecer: (token: string, contrasena: string) => pedir<SesionPublica>('restablecer', { cuerpo: { token, contrasena } }),
  invitacion: (token: string) => pedir<InvitacionPublica>('invitacion', { query: `?token=${encodeURIComponent(token)}` }),
  aceptar: (token: string, contrasena: string) => pedir<SesionPublica>('aceptar', { cuerpo: { token, contrasena } }),
  invitar: (token: string, personas: PersonaInvitada[]) => pedir<{ demo: boolean; resultados: ResultadoInvitacion[] }>('invitar', { cuerpo: { personas }, token }),
  invitaciones: (token: string) => pedir<{ demo: boolean; invitaciones: InvitacionAdmin[] }>('invitaciones', { token }),
  reenviar: (token: string, id: string) => pedir<{ demo: boolean; resultado: ResultadoInvitacion }>('reenviar', { cuerpo: { id }, token }),
  prueba: (token: string, accion: 'vencer' | 'reiniciar') => pedir<SesionPublica>('prueba', { cuerpo: { accion }, token }),
}

export function leerSesionGuardada(): SesionPublica | null {
  try {
    const raw = localStorage.getItem(CLAVE)
    return raw ? (JSON.parse(raw) as SesionPublica) : null
  } catch {
    return null
  }
}

export function guardarSesion(s: SesionPublica | null): void {
  try {
    if (s) localStorage.setItem(CLAVE, JSON.stringify(s))
    else localStorage.removeItem(CLAVE)
  } catch {
    /* sin almacenamiento */
  }
}
