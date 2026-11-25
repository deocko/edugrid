import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/ui'
import { hubFor } from '../../layout/nav'
import { userKey, visibleAnnouncements } from '../../lib/scope'
import { useApp } from '../../state/context'

/**
 * Pantalla de tarjetas de cada perfil: «Configuración» de la dirección y «Más» de docente,
 * familia y alumno. Una tarjeta pastel por sección.
 */
export function SettingsHub() {
  const { db, session } = useApp()
  const hub = hubFor(session.role)
  const unread = session.role === 'admin' ? 0 : visibleAnnouncements(db, session).filter((a) => !db.receipts.some((r) => r.announcementId === a.id && r.userKey === userKey(session))).length
  return (
    <>
      <PageHeader title={hub.title} subtitle={hub.subtitle} />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {hub.items.map((it) => (
          <li key={it.to}>
            <Link
              to={it.to}
              className={`subj-${it.color} group relative isolate flex h-full min-h-32 flex-col gap-2 rounded-2xl border border-[color-mix(in_srgb,var(--s)_22%,var(--c-line))] bg-[var(--s-bg)] p-3 text-heading no-underline shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--s)] hover:shadow-md focus-visible:border-[var(--s)] sm:p-4`}
            >
              {/* Ícono grande de fondo, recortado en la esquina: solo decoración */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl">
                <div className="absolute -right-5 -bottom-6 text-[var(--s)] opacity-[0.14] transition duration-300 group-hover:scale-110 group-hover:-rotate-6 group-hover:opacity-[0.22] dark:opacity-[0.16]">
                  <Icon name={it.icon} size={112} />
                </div>
              </div>
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-surface text-[var(--s-ink)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--s)_25%,transparent)]">
                <Icon name={it.icon} size={22} />
              </span>
              <span className="font-bold leading-tight">{it.label}</span>
              <span className="max-w-[85%] text-xs text-muted">{it.description}</span>
              {it.to === '/avisos' && unread > 0 && (
                <span className="absolute top-3 right-3 rounded-full bg-cyan px-2 text-xs font-bold text-navy" aria-label={`${unread} sin leer`}>{unread}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
