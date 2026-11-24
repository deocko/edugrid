import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Link } from 'react-router'
import { Icon, type IconName } from './Icon'

type Variant = 'primario' | 'secundario' | 'fantasma' | 'peligro'

const VARIANT: Record<Variant, string> = {
  primario: 'bg-primary text-on-primary hover:bg-primary-hover border border-transparent',
  secundario: 'bg-surface text-link border border-link/40 hover:bg-info-bg hover:border-link',
  fantasma: 'bg-transparent text-link border border-transparent hover:bg-info-bg',
  peligro: 'bg-danger-bg text-danger border border-danger/40 hover:brightness-95',
}

const BASE = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100'

export function Button({ variant = 'primario', icon, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: IconName }) {
  return (
    <button type="button" className={`${BASE} ${VARIANT[variant]} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  )
}

export function LinkButton({ to, variant = 'primario', icon, children, className = '' }: { to: string; variant?: Variant; icon?: IconName; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={`${BASE} ${VARIANT[variant]} no-underline ${className}`}>
      {icon && <Icon name={icon} size={18} />}
      {children}
    </Link>
  )
}

export function Card({ children, className = '', title, action, as: As = 'section' }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; as?: 'section' | 'div' | 'article' }) {
  return (
    <As className={`min-w-0 rounded-2xl border border-line bg-surface p-4 sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-bold text-heading">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </As>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-heading sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export type Tone = 'neutro' | 'exito' | 'aviso' | 'peligro' | 'info'

const TONE: Record<Tone, string> = {
  neutro: 'bg-surface-2 text-ink',
  exito: 'bg-success-bg text-success',
  aviso: 'bg-warning-bg text-warning',
  peligro: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
}

export function Badge({ tone = 'neutro', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${TONE[tone]}`}>{children}</span>
}

export function DemoBadge({ label = 'DEMO' }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-warning/50 bg-warning-bg px-2 py-0.5 text-xs font-bold tracking-wide text-warning" title="Datos de ejemplo, sin validez real">
      {label}
    </span>
  )
}

export function EmptyState({ icon = 'libro', title, children, action }: { icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-4 py-10 text-center">
      <span className="rounded-full bg-surface-2 p-3 text-muted">
        <Icon name={icon} size={26} />
      </span>
      <p className="font-semibold text-heading">{title}</p>
      {children && <p className="max-w-md text-sm text-muted">{children}</p>}
      {action}
    </div>
  )
}

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-3 py-16 text-muted">
      <svg className="eg-spin" width="32" height="32" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" fill="none" />
        <path d="M22 12a10 10 0 0 0-10-10" stroke="var(--c-accent)" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
      <span>{label}</span>
    </div>
  )
}

export function ErrorState({ title = 'Algo salió mal', children, action }: { title?: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-danger/40 bg-danger-bg px-4 py-10 text-center text-danger">
      <Icon name="alerta" size={28} />
      <p className="font-bold">{title}</p>
      {children && <div className="max-w-md text-sm">{children}</div>}
      {action}
    </div>
  )
}

export function Notice({ tone = 'info', icon = 'alerta', children }: { tone?: Tone; icon?: IconName; children: ReactNode }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm ${TONE[tone]}`}>
      <Icon name={icon} size={18} className="mt-0.5" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function Stat({ label, value, hint, icon, tone = 'neutro' }: { label: string; value: ReactNode; hint?: ReactNode; icon?: IconName; tone?: Tone }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex min-h-10 items-start justify-between gap-2">
        <p className="text-sm leading-5 font-medium text-muted">{label}</p>
        {icon && (
          <span className={`rounded-xl p-2 ${TONE[tone]}`}>
            <Icon name={icon} size={18} />
          </span>
        )}
      </div>
      <p className="mt-2 text-base font-bold tabular-nums break-words text-heading min-[360px]:text-lg min-[400px]:text-xl sm:text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

const FIELD = 'block w-full min-h-11 rounded-xl border border-line bg-surface px-3 py-2 text-ink placeholder:text-muted focus:border-primary'

export function Field({ label, hint, children, id }: { label: string; hint?: string; children: (id: string) => ReactNode; id?: string }) {
  const auto = useId()
  const fieldId = id ?? auto
  return (
    <div className="min-w-0">
      <label htmlFor={fieldId} className="mb-1 block text-sm font-semibold text-heading">
        {label}
      </label>
      {children(fieldId)}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${FIELD} ${className}`} {...rest} />
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${FIELD} ${className}`} {...rest}>
      {children}
    </select>
  )
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${FIELD} ${className}`} {...rest} />
}

export function Table({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full border-collapse text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  )
}

export const TH = 'border-b border-line px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted'
export const TD = 'border-b border-line px-3 py-2.5 align-top'

export function Tabs<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-10 shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold whitespace-nowrap ${value === o.value ? 'bg-surface text-heading shadow-sm' : 'text-muted hover:text-heading'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={title}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-navy/60"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3">
        <h2 className="text-lg font-bold text-heading">{title}</h2>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-surface-2" aria-label="Cerrar">
          <Icon name="cerrar" />
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{open && children}</div>
    </dialog>
  )
}

export function Avatar({ name, size = 40, src }: { name: string; size?: number; src?: string | null }) {
  if (src) return <img src={src} alt="" width={size} height={size} style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover ring-2 ring-cyan/60" />
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  return (
    <span aria-hidden="true" style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.34)) }} className="inline-flex shrink-0 items-center justify-center rounded-full bg-navy font-bold text-white ring-2 ring-cyan/60">
      {initials}
    </span>
  )
}

/**
 * Interruptor de encendido/apagado (sí/no, activar/desactivar).
 * Para una sola opción binaria que surte efecto al momento. Para aceptar términos o
 * elegir varios elementos de una lista se siguen usando casillas.
 */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  icons,
  hideLabel,
  className = '',
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
  icons?: { off: IconName; on: IconName }
  hideLabel?: boolean
  className?: string
}) {
  const id = useId()
  return (
    <div className={`flex min-h-11 items-center gap-3 ${className}`}>
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        aria-label={hideLabel && typeof label === 'string' ? label : undefined}
        aria-describedby={description ? `${id}-d` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`group relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? 'border-primary bg-primary' : 'border-muted bg-surface-2'
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-flex items-center justify-center rounded-full shadow-sm transition-all duration-200 motion-reduce:transition-none ${
            checked ? 'size-5 translate-x-[1.375rem] bg-white text-primary' : `translate-x-1 ${icons ? 'size-5 bg-muted text-surface' : 'size-4 bg-muted'}`
          }`}
        >
          {icons && <Icon name={checked ? icons.on : icons.off} size={13} />}
        </span>
      </button>
      {!hideLabel && (
        <span className="min-w-0">
          <label htmlFor={id} className="block cursor-pointer text-sm font-medium text-ink">
            {label}
          </label>
          {description && (
            <span id={`${id}-d`} className="block text-xs text-muted">
              {description}
            </span>
          )}
        </span>
      )}
    </div>
  )
}
