import { createContext, useContext } from 'react'
import type { EdugridRepository } from '../data/repository'
import type { AuditEntry, Database, Session } from '../data/types'
import type { SesionPublica } from '../data/cuentaTipos'

export type ThemeChoice = 'claro' | 'oscuro' | 'sistema'

export interface AuditInput {
  action: string
  detail: string
  kind?: AuditEntry['kind']
}

export interface StoreValue {
  /** «sin-datos»: todavía no hace falta cargar nada (pantallas de inicio de sesión). */
  status: 'sin-datos' | 'cargando' | 'listo' | 'error'
  error: string | null
  db: Database | null
  repo: EdugridRepository
  session: Session | null
  /** true en el Colegio Demo (botón «Ver demo»); false con una cuenta real. */
  esDemo: boolean
  /** Cuenta real con la que se entró (null en la demo). */
  cuenta: SesionPublica | null
  /** La pantalla «Ver demo» necesita los datos del Colegio Demo. */
  pedirDemo: () => void
  /** Entra a la demo con la persona elegida (sin contraseña). */
  login: (session: Session) => Promise<void>
  /** Entra con una cuenta real (la sesión ya la abrió la API). */
  entrarConCuenta: (cuenta: SesionPublica, detalle?: string) => void
  actualizarCuenta: (cuenta: SesionPublica) => void
  cambiarPerfil: (perfilId: string) => Promise<void>
  logout: () => void
  /** Ejecuta un cambio en el repositorio, registra la bitácora y refresca los datos. */
  act: (fn: (repo: EdugridRepository) => Promise<void>, audit?: AuditInput) => Promise<void>
  log: (audit: AuditInput) => Promise<void>
  resetDemo: () => Promise<void>
  theme: ThemeChoice
  setTheme: (t: ThemeChoice) => void
}

export const StoreContext = createContext<StoreValue | null>(null)

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore debe usarse dentro de StoreProvider')
  return ctx
}

/** Para pantallas dentro de la sesión: datos y sesión ya garantizados. */
export function useApp() {
  const ctx = useStore()
  if (!ctx.db || !ctx.session) throw new Error('Sesión no iniciada')
  return { ...ctx, db: ctx.db, session: ctx.session }
}
