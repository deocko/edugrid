import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ApiRepository, apiUrl } from '../data/apiAdapter'
import { LocalStorageRepository } from '../data/localAdapter'
import type { EdugridRepository } from '../data/repository'
import type { Database, Session } from '../data/types'
import { nowISO, uid } from '../lib/format'
import { StoreContext, type AuditInput, type StoreValue, type ThemeChoice } from './context'

const SESSION_KEY = 'edugrid.demo.sesion'
const THEME_KEY = 'edugrid.tema'

const readSession = (): Session | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

const readTheme = (): ThemeChoice => {
  try {
    const t = localStorage.getItem(THEME_KEY)
    return t === 'claro' || t === 'oscuro' ? t : 'sistema'
  } catch {
    return 'sistema'
  }
}

export function StoreProvider({ children, repository }: { children: ReactNode; repository?: EdugridRepository }) {
  const repoRef = useRef<EdugridRepository | null>(repository ?? null)
  const [status, setStatus] = useState<StoreValue['status']>('cargando')
  const [error, setError] = useState<string | null>(null)
  const [db, setDb] = useState<Database | null>(null)
  const [session, setSession] = useState<Session | null>(readSession)
  const [theme, setThemeState] = useState<ThemeChoice>(readTheme)
  /** Aviso cuando un cambio no se pudo guardar (por ejemplo, sin internet con la base de datos en línea). */
  const [saveError, setSaveError] = useState<string | null>(null)

  const getRepo = useCallback((): EdugridRepository => {
    if (!repoRef.current) {
      // Con una API configurada los datos viven en la base de datos; si no, en este navegador.
      const api = apiUrl()
      repoRef.current = api ? new ApiRepository(api) : new LocalStorageRepository()
    }
    return repoRef.current
  }, [])

  useEffect(() => {
    let alive = true
    try {
      getRepo()
        .snapshot()
        .then((snap) => {
          if (!alive) return
          setDb(snap)
          setStatus('listo')
        })
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : 'Error desconocido')
          setStatus('error')
        })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
      setStatus('error')
    }
    return () => {
      alive = false
    }
  }, [getRepo])

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'oscuro' || (theme === 'sistema' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  const refresh = useCallback(async () => setDb(await getRepo().snapshot()), [getRepo])

  const writeAudit = useCallback(
    async (s: Session | null, a: AuditInput) => {
      if (!s) return
      await getRepo().insert('audit', [
        { id: uid('lg'), at: nowISO(), actorKey: `${s.role}:${s.personId}`, actorName: s.name, role: s.role, action: a.action, detail: a.detail, kind: a.kind ?? 'cambio' },
      ])
    },
    [getRepo],
  )

  const value = useMemo<StoreValue>(
    () => ({
      status,
      error,
      db,
      repo: getRepo(),
      session,
      theme,
      setTheme: (t) => {
        setThemeState(t)
        try {
          localStorage.setItem(THEME_KEY, t)
        } catch {
          /* sin almacenamiento */
        }
      },
      login: async (s) => {
        setSession(s)
        try {
          localStorage.setItem(SESSION_KEY, JSON.stringify(s))
        } catch {
          /* sin almacenamiento */
        }
        await writeAudit(s, { action: 'Inició sesión', detail: 'Acceso demo sin contraseña', kind: 'acceso' })
        await refresh()
      },
      logout: () => {
        void writeAudit(session, { action: 'Cerró sesión', detail: '', kind: 'acceso' })
        setSession(null)
        try {
          localStorage.removeItem(SESSION_KEY)
        } catch {
          /* sin almacenamiento */
        }
      },
      act: async (fn, audit) => {
        try {
          await fn(getRepo())
          if (audit) await writeAudit(session, audit)
          setSaveError(null)
        } catch (e) {
          setSaveError(e instanceof Error ? e.message : 'Error desconocido')
          await refresh().catch(() => undefined)
          throw e
        }
        await refresh()
      },
      log: async (audit) => {
        await writeAudit(session, audit)
        await refresh()
      },
      resetDemo: async () => {
        await getRepo().reset()
        await refresh()
      },
    }),
    [status, error, db, session, theme, getRepo, refresh, writeAudit],
  )

  return (
    <StoreContext.Provider value={value}>
      {children}
      {saveError && (
        <div role="alert" className="fixed inset-x-3 bottom-24 z-[60] mx-auto flex max-w-md items-start gap-3 rounded-2xl bg-red-700 p-4 text-sm text-white shadow-lg lg:bottom-6">
          <p className="flex-1">
            <strong className="block">No se guardó el cambio</strong>
            {saveError}
          </p>
          <button type="button" className="rounded-lg px-2 py-1 font-semibold underline" onClick={() => setSaveError(null)}>
            Cerrar
          </button>
        </div>
      )}
    </StoreContext.Provider>
  )
}
