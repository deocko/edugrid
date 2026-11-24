import { useSyncExternalStore } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { Icon } from '../components/Icon'
import { Avatar, DemoBadge, Switch } from '../components/ui'
import { ROLE_LABEL } from '../lib/permissions'
import { userKey, visibleAnnouncements } from '../lib/scope'
import { useApp } from '../state/context'
import { hubFor, inHub, moduleForPath, NAV } from './nav'
import { ByEdugrid, SchoolLogo } from '../brand/SchoolBrand'
import { brandingOf } from '../lib/branding'

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')
const subscribeDark = (cb: () => void) => {
  const m = darkQuery()
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}

/** Interruptor claro/oscuro. Mientras no se toque, sigue el tema del dispositivo. */
function ThemeSwitch() {
  const { theme, setTheme } = useApp()
  const systemDark = useSyncExternalStore(subscribeDark, () => darkQuery().matches, () => false)
  const dark = theme === 'oscuro' || (theme === 'sistema' && systemDark)
  return (
    <Switch
      checked={dark}
      onChange={(next) => setTheme(next ? 'oscuro' : 'claro')}
      label="Modo oscuro"
      hideLabel
      icons={{ off: 'sol', on: 'luna' }}
      className="px-1"
    />
  )
}

export function AppShell() {
  const { session, db, logout } = useApp()
  const location = useLocation()
  const items = NAV[session.role]
  const moduleName = moduleForPath(location.pathname)
  const unread = visibleAnnouncements(db, session).filter((a) => !db.receipts.some((r) => r.announcementId === a.id && r.userKey === userKey(session))).length
  const notes = db.notifications.filter((n) => n.userKey === userKey(session) && !n.readAt).length
  const primary = items.slice(0, 4)
  const rest = items.slice(4)
  const hub = hubFor(session.role)

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
          <SchoolLogo height={34} onDark />
          <p className="mt-3 text-sm font-semibold text-white">{db.meta.school.name}</p>
          {brandingOf(db.meta).logo ? <ByEdugrid onDark className="mt-1" /> : <p className="text-xs text-nav-ink/90">Una escuela. Todos conectados.</p>}
        </div>
        <nav className="flex-1 overflow-y-auto px-3">
          <ul className="space-y-1">
            {items.map((it) => (
              <li key={it.to}>
                <NavLink
                  to={it.to}
                  end={it.end}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold no-underline ${isActive ? 'bg-primary text-nav-active' : 'text-nav-ink hover:bg-white/10 hover:text-white'}`
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
              <SchoolLogo height={28} />
            </span>
            <span className="hidden lg:inline">
              <DemoBadge label="MODO DEMO" />
            </span>
            <span className="lg:hidden">
              <DemoBadge />
            </span>
            <div className="ml-auto flex items-center gap-1">
              <Link to="/notificaciones" className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-heading no-underline hover:bg-surface-2" aria-label={notes > 0 ? `Notificaciones: ${notes} sin leer` : 'Notificaciones'}>
                <Icon name="campana" />
                {notes > 0 && <span className="absolute top-1.5 right-1.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 font-bold text-on-primary">{notes}</span>}
              </Link>
              <ThemeSwitch />
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
          <div className="mt-8 flex justify-center lg:hidden">
            <ByEdugrid />
          </div>
          <p className="mt-2 text-center text-xs text-muted lg:hidden">
            Datos de ejemplo (DEMO).{' '}
            <Link to="/privacidad" className="font-semibold text-link underline">
              Aviso de privacidad
            </Link>
          </p>
        </main>
        <footer className="mx-auto hidden w-full max-w-6xl px-4 pb-6 text-xs text-muted lg:block">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <ByEdugrid />
            <span>{brandingOf(db.meta).logo ? db.meta.school.name : 'EDUGRID · Administra tu Escuela'} · Datos de ejemplo (DEMO), no corresponden a personas reales.</span>
          </span>
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
                    {isActive && <span className="absolute top-0 h-1 w-8 rounded-b bg-primary dark:bg-link" aria-hidden="true" />}
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
              <NavLink
                to={hub.to}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-0 py-1.5 text-[11px] font-semibold no-underline ${inHub(session.role, location.pathname) ? 'text-link' : 'text-muted'}`}
                aria-current={inHub(session.role, location.pathname) ? 'page' : undefined}
              >
                {inHub(session.role, location.pathname) && <span className="absolute top-0 h-1 w-8 rounded-b bg-primary dark:bg-link" aria-hidden="true" />}
                <Icon name={session.role === 'admin' ? 'ajustes' : 'menu'} size={22} />
                <span className="max-w-full text-[9.5px] tracking-tight whitespace-nowrap min-[360px]:text-[10px] min-[400px]:text-[11px] min-[400px]:tracking-normal">{hub.label}</span>
                {session.role !== 'admin' && unread > 0 && hub.items.some((i) => i.to === '/avisos') && (
                  <span className="absolute top-1 right-[calc(50%-20px)] min-w-4 rounded-full bg-cyan px-1 text-[10px] leading-4 font-bold text-navy">{unread}</span>
                )}
              </NavLink>
            </li>
          )}
        </ul>
      </nav>
    </div>
  )
}
