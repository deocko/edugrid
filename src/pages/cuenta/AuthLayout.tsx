import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Logo } from '../../brand/Logo'

/** Marco de las pantallas sin sesión (iniciar sesión, alta de escuela, invitación…): mobile-first. */
export function AuthLayout({ title, subtitle, children, wide = false }: { title: string; subtitle?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-dvh bg-bg">
      <div className="bg-navy text-white">
        <div className={`mx-auto flex ${wide ? 'max-w-3xl' : 'max-w-lg'} flex-col gap-3 px-4 py-7 sm:py-10`}>
          <Link to="/" className="inline-flex w-fit no-underline" aria-label="EDUGRID, ir a iniciar sesión">
            <Logo height={40} tone="invertida" />
          </Link>
          <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
          {subtitle && <p className="text-[#dbe3ee]">{subtitle}</p>}
        </div>
      </div>
      <main id="contenido" className={`mx-auto ${wide ? 'max-w-3xl' : 'max-w-lg'} px-4 py-6`}>
        {children}
        <p className="mt-8 text-center text-xs text-muted">
          <Link to="/privacidad" className="font-semibold text-link underline">Aviso de privacidad</Link> · EDUGRID · Una escuela. Todos conectados.
        </p>
      </main>
    </div>
  )
}

/** Campo de contraseña con botón para mostrarla (útil en el celular). */
export function PasswordInput({ id, value, onChange, autoComplete, show, onToggle }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; show: boolean; onToggle: () => void }) {
  return (
    <div className="flex gap-2">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="block min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 py-2 text-ink placeholder:text-muted focus:border-primary"
      />
      <button type="button" onClick={onToggle} className="min-h-11 shrink-0 rounded-xl border border-line px-3 text-sm font-semibold text-link hover:bg-info-bg" aria-pressed={show}>
        {show ? 'Ocultar' : 'Mostrar'}
      </button>
    </div>
  )
}

/** Liga que en modo demo se muestra en pantalla en lugar de enviarse por correo. */
export function LigaDemo({ liga, titulo }: { liga: string; titulo: string }) {
  const local = liga.includes('#') ? `#${liga.split('#')[1]}` : liga
  return (
    <div className="rounded-xl border border-warning/40 bg-warning-bg p-3 text-sm text-warning" data-liga-demo>
      <p className="font-bold">{titulo}</p>
      <p className="mt-1">Modo demo: el correo no se envía. Usa esta liga para seguir:</p>
      <a href={local} className="mt-1 block font-semibold break-all text-link underline">{liga}</a>
    </div>
  )
}
