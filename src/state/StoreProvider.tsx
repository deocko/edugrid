import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ApiRepository, apiUrl } from '../data/apiAdapter'
import { cuentaApi, ErrorApi, guardarSesion, leerSesionGuardada } from '../data/cuenta'
import { ROL_DE_PERFIL, type SesionPublica } from '../data/cuentaTipos'
import { LocalStorageRepository } from '../data/localAdapter'
import type { EdugridRepository } from '../data/repository'
import type { Database, Session } from '../data/types'
import { nowISO, uid, usarFechaReal } from '../lib/format'
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

const writeDemoSession = (s: Session | null) => {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* sin almacenamiento */
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

/** La sesión de la app (rol + ficha) que corresponde al perfil elegido de una cuenta real. */
const sesionDeCuenta = (c: SesionPublica | null): Session | null =>
  c?.perfil ? { role: ROL_DE_PERFIL[c.perfil.tipo], personId: c.perfil.referencia, name: c.perfil.nombre || c.usuario.nombre } : null

export function StoreProvider({ children, repository }: { children: ReactNode; repository?: EdugridRepository }) {
  /** Cuenta real (correo y contraseña). Si no hay, la app es el Colegio Demo. */
  const [cuenta, setCuenta] = useState<SesionPublica | null>(() => (repository ? null : leerSesionGuardada()))
  const [demoSession, setDemoSession] = useState<Session | null>(readSession)
  /** La pantalla «Ver demo» pide los datos demo aunque todavía no haya sesión. */
  const [demoPedida, setDemoPedida] = useState(false)
  const session = cuenta ? sesionDeCuenta(cuenta) : demoSession
  const necesitaDatos = !!session || demoPedida
  const [status, setStatus] = useState<StoreValue['status']>(necesitaDatos ? 'cargando' : 'sin-datos')
  const [error, setError] = useState<string | null>(null)
  const [db, setDb] = useState<Database | null>(null)
  const [theme, setThemeState] = useState<ThemeChoice>(readTheme)
  /** Aviso cuando un cambio no se pudo guardar (por ejemplo, sin internet con la base de datos en línea). */
  const [saveError, setSaveError] = useState<string | null>(null)
  const auditarEntrada = useRef<string | null>(null)
  const pedirDemo = useCallback(() => setDemoPedida(true), [])

  const token = cuenta?.token ?? null
  // Con una API configurada los datos viven en la base de datos; si no, en este navegador.
  // Cada cuenta real tiene su propio repositorio (su escuela); sin cuenta, el del Colegio Demo.
  const repo = useMemo<EdugridRepository>(() => {
    if (repository) return repository
    const api = apiUrl()
    return api ? new ApiRepository(api, 60_000, token) : new LocalStorageRepository()
  }, [repository, token])

  useEffect(() => usarFechaReal(!!token), [token])

  const salirLocal = useCallback(() => {
    guardarSesion(null)
    setCuenta(null)
    setDb(null)
  }, [])

  const actualizarCuenta = useCallback((c: SesionPublica) => {
    guardarSesion(c)
    setCuenta(c)
  }, [])

  const writeAudit = useCallback(
    async (s: Session | null, a: AuditInput, r: EdugridRepository = repo) => {
      if (!s) return
      await r.insert('audit', [
        { id: uid('lg'), at: nowISO(), actorKey: `${s.role}:${s.personId}`, actorName: s.name, role: s.role, action: a.action, detail: a.detail, kind: a.kind ?? 'cambio' },
      ])
    },
    [repo],
  )

  // Carga los datos de la escuela de la sesión (o los del Colegio Demo).
  const vencida = !!cuenta?.escuela.pruebaVencida
  useEffect(() => {
    if (!necesitaDatos || vencida) {
      setStatus('sin-datos')
      return
    }
    let alive = true
    setStatus('cargando')
    setDb(null)
    ;(async () => {
      try {
        if (token) {
          // Revisa que la sesión siga viva y trae los días de prueba al día.
          const fresca = await cuentaApi.sesion(token)
          if (!alive) return
          actualizarCuenta(fresca)
          if (fresca.escuela.pruebaVencida) return
        }
        const snap = await repo.snapshot()
        if (!alive) return
        setDb(snap)
        setStatus('listo')
        const entrada = auditarEntrada.current
        auditarEntrada.current = null
        const s = token ? sesionDeCuenta(leerSesionGuardada()) : null
        if (entrada && s) void writeAudit(s, { action: 'Inició sesión', detail: entrada, kind: 'acceso' }, repo).then(() => repo.snapshot().then((d) => alive && setDb(d)))
      } catch (e) {
        if (!alive) return
        if (e instanceof ErrorApi && e.estado === 401) return salirLocal()
        setError(e instanceof Error ? e.message : 'Error desconocido')
        setStatus('error')
      }
    })()
    return () => {
      alive = false
    }
    // La sesión se vuelve a revisar solo cuando cambia el token o el repositorio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, necesitaDatos, vencida])

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

  const refresh = useCallback(async () => setDb(await repo.snapshot()), [repo])

  // Adaptador en línea: datos nuevos que llegan por detrás, guardados que fallaron,
  // sesión que expiró o prueba que terminó.
  useEffect(() => {
    return repo.suscribir?.((e) => {
      if (e.tipo === 'sesion') return salirLocal()
      if (e.tipo === 'prueba') {
        if (token) void cuentaApi.sesion(token).then(actualizarCuenta).catch(() => undefined)
        return
      }
      if (e.tipo === 'error') setSaveError(e.mensaje)
      void repo.snapshot().then(setDb)
    })
  }, [repo, token, salirLocal, actualizarCuenta])

  const value = useMemo<StoreValue>(
    () => ({
      status,
      error,
      db,
      repo,
      session,
      esDemo: !cuenta,
      cuenta,
      theme,
      setTheme: (t) => {
        setThemeState(t)
        try {
          localStorage.setItem(THEME_KEY, t)
        } catch {
          /* sin almacenamiento */
        }
      },
      pedirDemo,
      login: async (s) => {
        guardarSesion(null)
        setCuenta(null)
        setDemoSession(s)
        writeDemoSession(s)
        await writeAudit(s, { action: 'Inició sesión', detail: 'Acceso demo sin contraseña', kind: 'acceso' })
        await refresh()
      },
      entrarConCuenta: (c, detalle = 'Con correo y contraseña') => {
        writeDemoSession(null)
        setDemoSession(null)
        setDemoPedida(false)
        auditarEntrada.current = detalle
        actualizarCuenta(c)
      },
      actualizarCuenta,
      cambiarPerfil: async (perfilId) => {
        if (!cuenta) return
        actualizarCuenta(await cuentaApi.perfil(cuenta.token, perfilId))
      },
      logout: () => {
        if (cuenta) {
          void writeAudit(session, { action: 'Cerró sesión', detail: '', kind: 'acceso' })
            .then(() => repo.confirmar?.())
            .catch(() => undefined)
            .finally(() => void cuentaApi.cerrar(cuenta.token).catch(() => undefined))
          salirLocal()
          return
        }
        void writeAudit(session, { action: 'Cerró sesión', detail: '', kind: 'acceso' })
        setDemoSession(null)
        writeDemoSession(null)
      },
      act: async (fn, audit) => {
        try {
          await fn(repo)
          if (audit) await writeAudit(session, audit)
          // Con base de datos en línea, espera a que el servidor confirme (un solo lote).
          await repo.confirmar?.()
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
        await repo.reset()
        await refresh()
      },
    }),
    // `session` se deriva de cuenta y demoSession.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, error, db, repo, cuenta, demoSession, theme, refresh, writeAudit, salirLocal, actualizarCuenta, pedirDemo],
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
