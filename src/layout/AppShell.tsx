import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { Logo } from '../brand/Logo'
import { Icon } from '../components/Icon'
import { Avatar, DemoBadge } from '../components/ui'
import { ROLE_LABEL } from '../lib/permissions'
import { userKey, visibleAnnouncements } from '../lib/scope'
import { useApp, type ThemeChoice } from '../state/context'
import { moduleForPath, NAV } from './nav'

const THEMES: { value: ThemeChoice; label: string; icon: 'sol' | 'luna' | 'ajustes' }[] = [
  { value: 'claro', label: 'Tema: claro', icon: 'sol' },
  { value: 'oscuro', label: 'Tema: oscuro', icon: 'luna' },
  { value: 'sistema', label: 'Tema: según el dispositivo', icon: 'ajustes' },
]

function ThemeToggle() {
  const { theme, setTheme } = useApp()
  const idx = THEMES.findIndex((t) => t.value === theme)
  const current = THEMES[idx] ?? THEMES[2]!
  const next = THEMES[(idx + 1) % THEMES.length]!
  return (
    <button
      type="button"
      onClick={() => setTheme(next.value)}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-heading hover:bg-surface-2"
      aria-label={current.label}
      title={`${current.label} (toca para cambiar)`}
    >
      <Icon name={current.icon} />
    </button>
  )
}

export function AppShell() {
  const { session, db, logout } = useApp()
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()
  const items = NAV[session.role]
  const moduleName = moduleForPath(location.pathname)
  const unread = visibleAnnouncements(db, session).filter((a) => !db.receipts.some((r) => r.announcementId === a.id && r.userKey === userKey(session))).length
  const primary = items.slice(0, 4)
  const rest = items.slice(4)

  const badge = (to: string) =>
    to === '/avisos' && unread > 0 && session.role !== 'admin' ? (
      <span className="ml-auto rounded-full bg-cyan px-2 text-xs font-bold text-navy" aria-label={`${unread} sin leer`}>
        {unread}
      </span>
    ) : null

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <a href="#contenido" className="sr-only z-50 rounded bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Saltar al contenido
      </a>
      {/* Barra lateral (escritorio) */}
      <aside className="sticky top-0 hidden h-dvh flex-col bg-nav text-nav-ink lg:flex" aria-label="Navegación principal">
        <div className="px-5 pt-5 pb-4">
          <Logo height={30} tone="invertida" />
          <p className="mt-3 text-sm font-semibold text-white">{db.meta.school.name}</p>
          <p className="text-xs text-nav-ink/90">Una escuela. Todos conectados.</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3">
          <ul className="space-y-1">
            {items.map((it) => (
              <li key={it.to}>
                <NavLink
                  to={it.to}
                  end={it.end}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold no-underline ${isActive ? 'bg-white/10 text-nav-active' : 'text-nav-ink hover:bg-white/5 hover:text-white'}`
                  }
                >
                  <Icon name={it.icon} />
                  {it.label}
                  {badge(it.to)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-white/10 p-4 text-xs text-nav-ink">
          <Link to="/privacidad" className="font-semibold text-nav-ink underline">
            Aviso de privacidad
          </Link>
          <p className="mt-1">Versión demo con datos ficticios.</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur no-print">
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
            <span className="lg:hidden">
              <Logo height={26} />
            </span>
            <span className="hidden lg:inline">
              <DemoBadge label="MODO DEMO" />
            </span>
            <span className="lg:hidden">
              <DemoBadge />
            </span>
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
              <div className="hidden items-center gap-2 pl-2 sm:flex">
                <Avatar name={session.name} size={34} />
                <div className="max-w-[12rem] leading-tight">
                  <p className="truncate text-sm font-semibold text-heading">{session.name}</p>
                  <p className="truncate text-xs text-muted">{ROLE_LABEL[session.role]}</p>
                </div>
              </div>
              <button type="button" onClick={logout} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-heading hover:bg-surface-2" aria-label="Salir de la cuenta demo">
                <Icon name="salir" />
                <span className="hidden md:inline">Salir</span>
              </button>
            </div>
          </div>
        </header>

        <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-28 lg:pb-10" key={location.pathname}>
          {moduleName && (
            <p className="mb-1 text-sm font-bold text-link" data-modulo>
              {moduleName}
            </p>
          )}
          <Outlet />
          <p className="mt-8 text-center text-xs text-muted lg:hidden">
            Datos de ejemplo (DEMO).{' '}
            <Link to="/privacidad" className="font-semibold text-link underline">
              Aviso de privacidad
            </Link>
          </p>
        </main>
        <footer className="mx-auto hidden w-full max-w-6xl px-4 pb-6 text-xs text-muted lg:block">
          EDUGRID · Administra tu Escuela · Datos de ejemplo (DEMO), no corresponden a personas reales.
        </footer>
      </div>

      {/* Navegación inferior (móvil y tableta) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden no-print" aria-label="Navegación principal">
        <ul className="mx-auto grid max-w-xl" style={{ gridTemplateColumns: `repeat(${primary.length + (rest.length ? 1 : 0)}, minmax(0, 1fr))` }}>
          {primary.map((it) => (
            <li key={it.to}>
              <NavLink
                to={it.to}
                end={it.end}
                className={({ isActive }) => `relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-semibold no-underline ${isActive ? 'text-link' : 'text-muted'}`}
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute top-0 h-1 w-8 rounded-b bg-cyan" aria-hidden="true" />}
                    <Icon name={it.icon} size={22} />
                    <span className="max-w-full truncate">{it.short ?? it.label}</span>
                    {it.to === '/avisos' && unread > 0 && session.role !== 'admin' && (
                      <span className="absolute top-1 right-[calc(50%-20px)] min-w-4 rounded-full bg-cyan px-1 text-[10px] leading-4 font-bold text-navy">{unread}</span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
          {rest.length > 0 && (
            <li>
              <button type="button" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-semibold text-muted">
                <Icon name={moreOpen ? 'cerrar' : 'menu'} size={22} />
                Más
              </button>
            </li>
          )}
        </ul>
        {moreOpen && (
          <div className="absolute inset-x-0 bottom-full border-t border-line bg-surface p-3 shadow-lg">
            <ul className="mx-auto grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-3">
              {rest.map((it) => (
                <li key={it.to}>
                  <NavLink to={it.to} onClick={() => setMoreOpen(false)} className="flex min-h-11 items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm font-semibold text-heading no-underline">
                    <Icon name={it.icon} />
                    {it.label}
                  </NavLink>
                </li>
              ))}
              <li>
                <NavLink to="/privacidad" onClick={() => setMoreOpen(false)} className="flex min-h-11 items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm font-semibold text-heading no-underline">
                  <Icon name="escudo" />
                  Privacidad
                </NavLink>
              </li>
            </ul>
          </div>
        )}
      </nav>
    </div>
  )
}
