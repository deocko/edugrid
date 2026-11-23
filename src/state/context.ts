import { createContext, useContext } from 'react'
import type { EdugridRepository } from '../data/repository'
import type { AuditEntry, Database, Session } from '../data/types'

export type ThemeChoice = 'claro' | 'oscuro' | 'sistema'

export interface AuditInput {
  action: string
  detail: string
  kind?: AuditEntry['kind']
}

export interface StoreValue {
  status: 'cargando' | 'listo' | 'error'
  error: string | null
  db: Database | null
  repo: EdugridRepository
  session: Session | null
  login: (session: Session) => Promise<void>
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
