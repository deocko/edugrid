import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/ui'
import { ADMIN_SETTINGS } from '../../layout/nav'

/** Configuración de la dirección: una tarjeta por sección de la escuela. */
export function SettingsHub() {
  return (
    <>
      <PageHeader title="Configuración" subtitle="Todo lo que administra la dirección, en un solo lugar." />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {ADMIN_SETTINGS.map((it) => (
          <li key={it.to}>
            <Link to={it.to} className="flex h-full min-h-28 flex-col gap-2 rounded-2xl border border-line bg-surface p-3 text-heading no-underline shadow-sm transition hover:border-primary hover:bg-surface-2 focus-visible:border-primary sm:p-4">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-info-bg text-info">
                <Icon name={it.icon} size={22} />
              </span>
              <span className="font-bold leading-tight">{it.label}</span>
              <span className="text-xs text-muted">{it.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
