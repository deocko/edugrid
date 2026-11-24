// Logotipo EDUGRID — Manual de Identidad v1.0.
// Colores fijos del manual: no recolorear ni deformar. En modo oscuro el logo
// se coloca sobre una placa clara para conservar sus colores originales.

const NAVY = '#101D32'
const CYAN = '#35C5D9'
// «GRID» sobre fondo claro: #35C5D9 sobre blanco da 2.07:1 (no cumple AA para texto grande, 3:1).
// Solo para las letras del logotipo sobre placa blanca se usa este cyan oscurecido (3.82:1).
const CYAN_TEXT_ON_LIGHT = '#168FA3'

export function Isotipo({ size = 40, title }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      {/* Hexágono abierto: el trazo se interrumpe en la esquina superior derecha */}
      <path d="M44 7.6 L32 1 L5.7 16 L5.7 48 L32 63 L58.3 48 L58.3 26" fill="none" stroke={NAVY} strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Banda diagonal cyan */}
      <path d="M18 44 L46 16" stroke={CYAN} strokeWidth="9" strokeLinecap="round" />
    </svg>
  )
}

export function Logo({ height = 36, plate = 'auto' }: { height?: number; plate?: 'auto' | 'never' }) {
  const width = height * 4.1
  const svg = (
    <svg width={width} height={height} viewBox="0 0 246 60" role="img" aria-label="EDUGRID">
      <g transform="translate(0 -2) scale(0.97)">
        <path d="M44 7.6 L32 1 L5.7 16 L5.7 48 L32 63 L58.3 48 L58.3 26" fill="none" stroke={NAVY} strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 44 L46 16" stroke={CYAN} strokeWidth="9" strokeLinecap="round" />
      </g>
      <text x="72" y="44" fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif" fontSize="36" fontWeight="800" letterSpacing="1">
        <tspan fill={NAVY}>EDU</tspan>
        <tspan fill={CYAN_TEXT_ON_LIGHT}>GRID</tspan>
      </text>
    </svg>
  )
  if (plate === 'never') return svg
  return <span className="inline-flex rounded-lg dark:bg-white dark:px-2 dark:py-1">{svg}</span>
}
