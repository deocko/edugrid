import type { CardBrand } from '../data/types'
import { maskedNumber } from '../lib/cards'

const FACE: Record<CardBrand | 'none', string> = {
  visa: 'linear-gradient(135deg, #0b2a6b 0%, #1769d2 55%, #35c5d9 120%)',
  mastercard: 'linear-gradient(135deg, #141414 0%, #2f2f35 60%, #4a3a2a 120%)',
  amex: 'linear-gradient(135deg, #0b4f5c 0%, #0e8fa0 60%, #6fd3c5 130%)',
  none: 'linear-gradient(135deg, #101d32 0%, #2b3d5c 70%, #4b5b72 130%)',
}

function BrandMark({ brand }: { brand: CardBrand | null }) {
  if (brand === 'visa') return <span className="text-2xl font-black tracking-tight italic">VISA</span>
  if (brand === 'mastercard')
    return (
      <span className="relative inline-flex h-8 w-12" aria-label="Mastercard">
        <span className="absolute left-0 size-8 rounded-full bg-[#eb001b]" />
        <span className="absolute right-0 size-8 rounded-full bg-[#f79e1b] mix-blend-screen" />
      </span>
    )
  if (brand === 'amex') return <span className="rounded border-2 border-white px-1.5 text-sm font-black tracking-widest">AMEX</span>
  return <span className="text-sm font-semibold text-white/90">Tarjeta</span>
}

function Chip() {
  return (
    <span aria-hidden="true" className="relative block h-8 w-11 overflow-hidden rounded-md bg-gradient-to-br from-[#f4d58d] to-[#c9a24a]">
      <span className="absolute inset-x-0 top-1/2 h-px bg-[#8a6d2a]/60" />
      <span className="absolute inset-y-0 left-1/3 w-px bg-[#8a6d2a]/60" />
      <span className="absolute inset-y-0 right-1/3 w-px bg-[#8a6d2a]/60" />
    </span>
  )
}

/**
 * Tarjeta virtual que se puede girar (frente y reverso).
 * `number` puede ser el número que se está escribiendo (vista previa) o ya enmascarado.
 */
export function VirtualCard({
  brand,
  number,
  last4,
  holder,
  expiry,
  cvv,
  flipped,
  onFlip,
  schoolName,
}: {
  brand: CardBrand | null
  number?: string
  last4?: string
  holder: string
  expiry: string
  cvv?: string
  flipped: boolean
  onFlip?: () => void
  schoolName: string
}) {
  const shown = number ?? (last4 ? maskedNumber(brand, last4) : '•••• •••• •••• ••••')
  const label = `Tarjeta ${brand ? brand : ''} terminación ${last4 ?? shown.replace(/\D/g, '').slice(-4)}. ${flipped ? 'Reverso' : 'Frente'}.`
  const Wrapper = onFlip ? 'button' : 'div'
  return (
    <div className="w-full max-w-[22rem] [perspective:1200px]">
      <Wrapper
        {...(onFlip ? { type: 'button' as const, onClick: onFlip, 'aria-label': `${label} Toca para girarla.` } : { role: 'img', 'aria-label': label })}
        className="relative block aspect-[1.586] w-full rounded-2xl text-left text-white transition-transform duration-700 [transform-style:preserve-3d] motion-reduce:transition-none"
        style={{ transform: flipped ? 'rotateY(180deg)' : 'none' }}
      >
        {/* Frente */}
        <span className="absolute inset-0 flex flex-col justify-between overflow-hidden rounded-2xl p-5 shadow-lg [backface-visibility:hidden]" style={{ background: FACE[brand ?? 'none'] }} aria-hidden="true">
          <span className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-white/10" />
          <span className="pointer-events-none absolute -bottom-20 -left-10 size-56 rounded-full bg-white/5" />
          <span className="relative flex items-start justify-between">
            <span className="text-xs font-semibold tracking-wide text-white/90 uppercase">{schoolName}</span>
            <span className="rounded bg-white/20 px-1.5 text-[10px] font-bold tracking-wider">DEMO</span>
          </span>
          <span className="relative flex items-center gap-3">
            <Chip />
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="text-white/80">
              <path d="M8.5 7.5a6.5 6.5 0 0 1 0 9M12 5a10 10 0 0 1 0 14M5 10a3 3 0 0 1 0 4" />
            </svg>
          </span>
          <span className="relative font-mono text-lg tracking-[0.12em] tabular-nums sm:text-xl">{shown || '•••• •••• •••• ••••'}</span>
          <span className="relative flex items-end justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-[10px] tracking-wider text-white/75 uppercase">Titular</span>
              <span className="block truncate text-sm font-semibold uppercase">{holder || 'Nombre del titular'}</span>
            </span>
            <span className="shrink-0">
              <span className="block text-[10px] tracking-wider text-white/75 uppercase">Vence</span>
              <span className="block font-mono text-sm font-semibold">{expiry || 'MM/AA'}</span>
            </span>
            <span className="shrink-0">
              <BrandMark brand={brand} />
            </span>
          </span>
        </span>
        {/* Reverso */}
        <span className="absolute inset-0 flex flex-col overflow-hidden rounded-2xl shadow-lg [backface-visibility:hidden] [transform:rotateY(180deg)]" style={{ background: FACE[brand ?? 'none'] }} aria-hidden="true">
          <span className="mt-6 block h-11 w-full bg-[#0b0f17]" />
          <span className="mx-5 mt-4 flex items-center gap-2">
            <span className="flex h-9 flex-1 items-center rounded bg-[repeating-linear-gradient(135deg,#f5f5f0_0_6px,#e6e4dc_6px_12px)] px-2 font-serif text-sm text-[#243247] italic">{holder || 'Firma'}</span>
            <span className="flex h-9 w-14 items-center justify-center rounded bg-white font-mono text-sm font-bold text-[#101d32]">{cvv ? cvv.replace(/./g, '•') : '•••'}</span>
          </span>
          <span className="mx-5 mt-1 text-right text-[10px] text-white/80">Código de seguridad</span>
          <span className="mx-5 mt-auto mb-4 text-[10px] leading-snug text-white/85">
            Tarjeta de prueba (DEMO). La escuela solo guarda la marca, los últimos 4 dígitos y el vencimiento. Nunca el número completo ni el código.
          </span>
        </span>
      </Wrapper>
    </div>
  )
}
