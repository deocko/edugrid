import type { HeaderArt as Art } from '../layout/headerArt'
import { Icon } from './Icon'

/**
 * Ilustración decorativa del encabezado: formas suaves en el color de la sección sobre el azul de la
 * escuela, con el ícono de la sección en grande. Es solo decoración (aria-hidden).
 */
export function HeaderArt({ art }: { art: Art }) {
  return (
    <div aria-hidden="true" className={`subj-${art.color} pointer-events-none absolute inset-0 overflow-hidden rounded-3xl`}>
      <svg className="absolute -right-10 -bottom-12 h-[150%] w-auto opacity-60 sm:-right-4 sm:opacity-100" viewBox="0 0 260 220" fill="none">
        <circle cx="160" cy="120" r="96" style={{ fill: 'var(--s-dk)' }} opacity="0.28" />
        <circle cx="160" cy="120" r="64" style={{ fill: 'var(--s-dk)' }} opacity="0.35" />
        <circle cx="62" cy="52" r="26" fill="var(--color-cyan)" opacity="0.35" />
        <circle cx="236" cy="38" r="12" fill="#fff" opacity="0.18" />
        <rect x="18" y="128" width="70" height="70" rx="18" transform="rotate(-14 53 163)" fill="#fff" opacity="0.1" />
        {Array.from({ length: 4 }, (_, r) => Array.from({ length: 5 }, (_, c) => <circle key={`${r}-${c}`} cx={104 + c * 12} cy={18 + r * 12} r="2" fill="#fff" opacity="0.25" />))}
      </svg>
      <div className="absolute top-1/2 right-6 hidden -translate-y-1/2 sm:right-16 sm:block">
        <div className="relative">
          <span className="flex size-24 rotate-[-8deg] items-center justify-center rounded-[28px] bg-white/15 text-white shadow-lg ring-1 ring-white/25 backdrop-blur-sm">
            <Icon name={art.icon} size={52} />
          </span>
          <span className="absolute -top-4 -left-8 flex size-12 rotate-12 items-center justify-center rounded-2xl text-navy shadow-md" style={{ background: 'var(--s-dk)' }}>
            <Icon name={art.accent} size={24} />
          </span>
        </div>
      </div>
      <div className="absolute top-4 right-4 sm:hidden">
        <span className="flex size-14 rotate-[-8deg] items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/25">
          <Icon name={art.icon} size={30} />
        </span>
      </div>
    </div>
  )
}
