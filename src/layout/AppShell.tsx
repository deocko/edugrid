import { useEffect, useSyncExternalStore } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { Icon } from '../components/Icon'
import { Avatar, DemoBadge, Switch } from '../components/ui'
import { ROLE_LABEL } from '../lib/permissions'
import { userKey, visibleAnnouncements } from '../lib/scope'
import { useApp } from '../state/context'
import { hubFor, inHub, moduleForPath, NAV } from './nav'
import { ByEdugrid, SchoolLogo } from '../brand/SchoolBrand'
import { brandingOf } from '../lib/branding'
import { profileOf } from '../lib/profile'
import { artFor } from './headerArt'

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

/** Botón de la barra inferior: círculo con ícono, o píldora con ícono y nombre si es la sección activa. */
const pillClass = (active: boolean) =>
  `relative flex h-11 items-center justify-center rounded-full no-underline transition-all duration-300 ease-out min-[400px]:h-12 ${
    active ? 'gap-1.5 bg-primary pr-3.5 pl-3 text-on-primary shadow-md min-[400px]:pr-4' : 'w-11 text-muted hover:bg-surface-2 hover:text-heading min-[400px]:w-12'
  }`

/** «Configuración» no cabe en celulares angostos: ahí se ve «Ajustes» (el lector de pantalla sigue diciendo «Configuración»). */
function BarWord({ label }: { label: string }) {
  if (label !== 'Configuración') return <>{label}</>
  return (
    <>
      <span aria-hidden="true" className="min-[400px]:hidden">Ajustes</span>
      <span className="sr-only min-[400px]:not-sr-only">{label}</span>
    </>
  )
}

/**
 * Nombre del botón activo. Todos los nombres de la barra se apilan en la misma celda (los demás,
 * invisibles), así el botón activo mide siempre lo que mide el nombre más largo.
 */
function ActiveLabel({ label, all }: { label: string; all: string[] }) {
  return (
    <span className="grid text-[13px] font-bold whitespace-nowrap min-[400px]:text-sm">
      {all.map((l) => (
        <span key={l} aria-hidden="true" className="invisible col-start-1 row-start-1">
          <BarWord label={l} />
        </span>
      ))}
      <span className="col-start-1 row-start-1 text-center">
        <BarWord label={label} />
      </span>
    </span>
  )
}

/** Contador de avisos sin leer sobre el ícono (o junto al nombre cuando la sección está activa). */
function NavCount({ n, active }: { n: number; active: boolean }) {
  return active ? (
    <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-cyan px-1 text-center text-[11px] leading-5 font-bold text-navy ring-2 ring-surface"><span aria-hidden="true">{n}</span><span className="sr-only">, {n} sin leer</span></span>
  ) : (
    <span className="absolute top-0.5 right-0.5 min-w-4 rounded-full bg-cyan px-1 text-center text-[10px] leading-4 font-bold text-navy"><span aria-hidden="true">{n}</span><span className="sr-only">, {n} sin leer</span></span>
  )
}

export function AppShell() {
  const { session, db, logout } = useApp()
  const location = useLocation()
  // Al cambiar de página (o al regresar con «atrás») se empieza siempre desde arriba;
  // los cambios de pestaña dentro de la misma página (?vista=…) conservan la posición.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [location.pathname])
  const items = NAV[session.role]
  const moduleName = moduleForPath(location.pathname)
  const unread = visibleAnnouncements(db, session).filter((a) => !db.receipts.some((r) => r.announcementId === a.id && r.userKey === userKey(session))).length
  const notes = db.notifications.filter((n) => n.userKey === userKey(session) && !n.readAt).length
  const primary = items.slice(0, 4)
  const rest = items.slice(4)
  const hub = hubFor(session.role)
  const barLabels = [...primary.map((it) => it.short ?? it.label), ...(rest.length ? [hub.label] : [])]
  const me = profileOf(db, session)
  const onProfile = location.pathname === '/perfil'

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
        <div className="border-t border-white/10 p-3">
          <Link
            to="/perfil"
            aria-current={onProfile ? 'page' : undefined}
            className={`group flex items-center gap-3 rounded-2xl p-2 no-underline transition ${onProfile ? 'bg-primary text-nav-active' : 'text-white hover:bg-white/10'}`}
          >
            <Avatar name={me.name} src={me.avatar} size={42} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-sm font-semibold break-words">{me.name}</span>
              <span className={`block text-xs ${onProfile ? 'text-nav-active' : 'text-nav-ink'}`}>{me.roleLabel}</span>
              <span className={`mt-0.5 block text-xs font-semibold ${onProfile ? 'text-nav-active' : 'text-nav-ink underline'}`}>Editar mi perfil</span>
            </span>
            <Icon name="ajustes" size={18} className={onProfile ? '' : 'text-nav-ink group-hover:text-white'} />
          </Link>
          <p className="mt-2 px-2 text-xs text-nav-ink">
            <Link to="/privacidad" className="font-semibold text-nav-ink underline">Aviso de privacidad</Link> · Demo con datos ficticios.
          </p>
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
              <Link to="/perfil" aria-label={`Mi perfil: ${me.name}`} className="hidden min-h-11 items-center gap-2 rounded-xl px-2 no-underline hover:bg-surface-2 sm:inline-flex">
                <Avatar name={me.name} src={me.avatar} size={34} />
                <span className="max-w-[12rem] leading-tight">
                  <span className="block truncate text-sm font-semibold text-heading">{me.name}</span>
                  <span className="block truncate text-xs text-muted">{ROLE_LABEL[session.role]}</span>
                </span>
              </Link>
              <button type="button" onClick={logout} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-heading hover:bg-surface-2" aria-label="Salir de la cuenta demo">
                <Icon name="salir" />
                <span className="hidden md:inline">Salir</span>
              </button>
            </div>
          </div>
        </header>

        <main id="contenido" className={`subj-${artFor(location.pathname).color} mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-28 lg:pb-10`} key={location.pathname}>
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

      {/* Navegación inferior (móvil y tableta): barra flotante de íconos; la sección activa se muestra como botón con su nombre */}
      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] min-[360px]:px-3 lg:hidden no-print" aria-label="Navegación principal">
        <ul className="pointer-events-auto mx-auto flex max-w-md items-center justify-between gap-0.5 rounded-full border border-line bg-surface/95 p-1.5 shadow-[0_8px_30px_rgb(16_29_50/0.18)] backdrop-blur dark:shadow-[0_8px_30px_rgb(0_0_0/0.5)]">
          {primary.map((it) => (
            <li key={it.to} className="flex justify-center has-[[aria-current=page]]:min-w-0">
              <NavLink to={it.to} end={it.end} className={({ isActive }) => pillClass(isActive)}>
                {({ isActive }) => (
                  <>
                    <Icon name={it.icon} size={22} />
                    {isActive ? <ActiveLabel label={it.short ?? it.label} all={barLabels} /> : <span className="sr-only">{it.short ?? it.label}</span>}
                    {it.to === '/avisos' && unread > 0 && session.role !== 'admin' && <NavCount n={unread} active={isActive} />}
                  </>
                )}
              </NavLink>
            </li>
          ))}
          {rest.length > 0 && (() => {
            const active = inHub(session.role, location.pathname)
            return (
              <li className="flex justify-center">
                <Link to={hub.to} aria-current={active ? 'page' : undefined} className={pillClass(active)}>
                  <Icon name={session.role === 'admin' ? 'ajustes' : 'menu'} size={22} />
                  {active ? <ActiveLabel label={hub.label} all={barLabels} /> : <span className="sr-only">{hub.label}</span>}
                  {session.role !== 'admin' && unread > 0 && hub.items.some((i) => i.to === '/avisos') && <NavCount n={unread} active={active} />}
                </Link>
              </li>
            )
          })()}
        </ul>
      </nav>
    </div>
  )
}
