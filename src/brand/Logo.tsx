// Logotipo EDUGRID — Manual de Identidad v1.0.
// Forma y colores del arte original del manual (no recolorear ni deformar).
// Versiones: a color sobre fondos claros e «invertida» (letras EDU y hexágono en blanco)
// sobre fondos oscuros, como indica el manual.
import { ISO_CYAN_D, ISO_NAVY_D, ISO_VIEWBOX, LOGO_CYAN, LOGO_CYAN_D, LOGO_NAVY, LOGO_NAVY_D, LOGO_VIEWBOX } from './logoPaths'

/** auto: a color en modo claro e invertida en modo oscuro. */
export type LogoTone = 'auto' | 'color' | 'invertida'

function inkClass(tone: LogoTone) {
  if (tone === 'invertida') return 'fill-white'
  if (tone === 'color') return ''
  return 'dark:fill-white'
}

export function Isotipo({ size = 40, title, tone = 'auto' }: { size?: number; title?: string; tone?: LogoTone }) {
  return (
    <svg
      width={(size * ISO_VIEWBOX.w) / ISO_VIEWBOX.h}
      height={size}
      viewBox={`0 0 ${ISO_VIEWBOX.w} ${ISO_VIEWBOX.h}`}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path fill={LOGO_NAVY} className={inkClass(tone)} fillRule="evenodd" d={ISO_NAVY_D} />
      <path fill={LOGO_CYAN} fillRule="evenodd" d={ISO_CYAN_D} />
    </svg>
  )
}

export function Logo({ height = 36, tone = 'auto' }: { height?: number; tone?: LogoTone }) {
  return (
    <svg width={(height * LOGO_VIEWBOX.w) / LOGO_VIEWBOX.h} height={height} viewBox={`0 0 ${LOGO_VIEWBOX.w} ${LOGO_VIEWBOX.h}`} role="img" aria-label="EDUGRID">
      <path fill={LOGO_NAVY} className={inkClass(tone)} fillRule="evenodd" d={LOGO_NAVY_D} />
      <path fill={LOGO_CYAN} fillRule="evenodd" d={LOGO_CYAN_D} />
    </svg>
  )
}
