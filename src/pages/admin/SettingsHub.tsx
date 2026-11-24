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
            <Link
              to={it.to}
              className="group relative isolate flex h-full min-h-32 flex-col gap-2 rounded-2xl border border-line bg-linear-to-br from-surface to-surface-2 p-3 text-heading no-underline shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md focus-visible:border-primary sm:p-4"
            >
              {/* Ícono grande de fondo, recortado en la esquina: solo decoración */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl">
                <div className="absolute -right-5 -bottom-6 text-primary opacity-[0.09] transition duration-300 group-hover:scale-110 group-hover:-rotate-6 group-hover:opacity-[0.14] dark:text-link dark:opacity-[0.12]">
                  <Icon name={it.icon} size={112} />
                </div>
                <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-primary to-cyan opacity-70" />
              </div>
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-info-bg text-info shadow-sm ring-1 ring-line">
                <Icon name={it.icon} size={22} />
              </span>
              <span className="font-bold leading-tight">{it.label}</span>
              <span className="max-w-[85%] text-xs text-muted">{it.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
