// Marca de cada escuela: logo y colores. EDUGRID queda como «by EDUGRID».
// Los colores que elige la escuela se ajustan solos para que el texto se lea bien (WCAG AA).
import type { Branding } from '../data/types'

export const EDUGRID_PRIMARY = '#1769d2'
export const EDUGRID_ACCENT = '#35c5d9'
export const DEFAULT_BRANDING: Branding = { logo: null, primary: EDUGRID_PRIMARY, accent: EDUGRID_ACCENT }
export const DEFAULT_PLACES = ['Puerta principal', 'Puerta de preescolar', 'Salón']

type RGB = [number, number, number]
const hexToRgb = (hex: string): RGB => {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full.slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const rgbToHex = ([r, g, b]: RGB) => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`
export const isHex = (s: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.trim())

const lum = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as RGB
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m) as [number, number]
  return (x + 0.05) / (y + 0.05)
}
/** Mezcla a con b: t=0 deja a, t=1 da b. */
export const mix = (a: string, b: string, t: number) => {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t])
}
/** Oscurece (o aclara) poco a poco hasta llegar al contraste pedido contra el fondo. */
export function ensureContrast(color: string, bg: string, min: number) {
  const toward = lum(bg) > 0.4 ? '#000000' : '#ffffff'
  let c = color
  for (let i = 1; i <= 20 && contrast(c, bg) < min; i++) c = mix(color, toward, i * 0.05)
  return c
}

export interface BrandTokens {
  primary: string
  primaryHover: string
  nav: string
  accentOnNav: string
  linkDark: string
  /** true si se tuvo que ajustar el tono del color principal para que el texto blanco se lea. */
  adjusted: boolean
}

const SURFACE_DARK = '#101d32'

export function brandTokens(b: Branding): BrandTokens {
  const base = isHex(b.primary) ? b.primary : EDUGRID_PRIMARY
  const accent = isHex(b.accent) ? b.accent : EDUGRID_ACCENT
  const primary = ensureContrast(base, '#ffffff', 4.6)
  const nav = mix(primary, '#0a0f1a', 0.72)
  return {
    primary,
    primaryHover: mix(primary, '#000000', 0.15),
    nav,
    accentOnNav: ensureContrast(accent, nav, 4.6),
    linkDark: ensureContrast(mix(primary, '#ffffff', 0.35), SURFACE_DARK, 4.8),
    adjusted: primary.toLowerCase() !== base.toLowerCase(),
  }
}

export const isDefaultBranding = (b: Branding) => b.primary.toLowerCase() === EDUGRID_PRIMARY && b.accent.toLowerCase() === EDUGRID_ACCENT

/** Hoja de estilos que reemplaza los tokens de color con los de la escuela. Vacía si usa los de EDUGRID. */
export function brandCss(b: Branding) {
  if (isDefaultBranding(b)) return ''
  const t = brandTokens(b)
  const infoBg = mix(t.primary, '#ffffff', 0.9)
  const infoBgDark = mix(t.primary, SURFACE_DARK, 0.75)
  return `:root{--c-primary:${t.primary};--c-primary-hover:${t.primaryHover};--c-link:${t.primary};--c-info:${t.primary};--c-info-bg:${infoBg};--c-focus:${t.primary};--c-nav:${t.nav};--c-accent:${t.accentOnNav};--c-brand-navy:${t.nav};--c-brand-accent:${t.accentOnNav}}
.dark{--c-primary:${t.primary};--c-primary-hover:${mix(t.primary, '#ffffff', 0.12)};--c-link:${t.linkDark};--c-info:${t.linkDark};--c-info-bg:${infoBgDark};--c-focus:${t.accentOnNav};--c-nav:${mix(t.nav, '#000000', 0.25)}}`
}

/** Convierte cualquier imagen (PNG, JPG, SVG) en PNG de máximo 480×240 px, conservando transparencia. */
export async function logoToPng(src: string | File): Promise<string> {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('No se pudo abrir la imagen del logo.'))
      i.src = url
    })
    const w = img.naturalWidth || 480
    const h = img.naturalHeight || 240
    const scale = Math.min(1, 480 / w, 240 / h) || 1
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(w * scale))
    canvas.height = Math.max(1, Math.round(h * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No se pudo procesar el logo.')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } finally {
    if (typeof src !== 'string') URL.revokeObjectURL(url)
  }
}

/** Escuelas de ejemplo para ver cómo se adapta la plataforma a cada institución. Ficticias. */
export interface SchoolPreset {
  id: string
  name: string
  shortName: string
  primary: string
  accent: string
  logoSvg: string | null
}

const svg = (body: string, w = 360, h = 120) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`)}`

export const SCHOOL_PRESETS: SchoolPreset[] = [
  { id: 'edugrid', name: 'Colegio Demo EDUGRID', shortName: 'Colegio Demo', primary: EDUGRID_PRIMARY, accent: EDUGRID_ACCENT, logoSvg: null },
  {
    id: 'arboleda',
    name: 'Colegio Arboleda (DEMO)',
    shortName: 'Arboleda',
    primary: '#1f7a4d',
    accent: '#f2b632',
    logoSvg: svg(
      `<circle cx="60" cy="60" r="52" fill="#1f7a4d"/><path d="M60 22 34 62h14L32 86h56L72 62h14z" fill="#fff"/><rect x="55" y="86" width="10" height="14" rx="2" fill="#f2b632"/>` +
        `<text x="128" y="62" font-family="Georgia,serif" font-size="38" font-weight="700" fill="#1f7a4d">Arboleda</text><text x="130" y="90" font-family="Arial,sans-serif" font-size="16" letter-spacing="4" fill="#9a6b00">COLEGIO · DEMO</text>`,
    ),
  },
  {
    id: 'montesol',
    name: 'Instituto Montesol (DEMO)',
    shortName: 'Montesol',
    primary: '#8c1d40',
    accent: '#f0a500',
    logoSvg: svg(
      `<rect x="8" y="8" width="104" height="104" rx="22" fill="#8c1d40"/><circle cx="60" cy="52" r="18" fill="#f0a500"/><path d="M14 98 46 62l18 20 12-12 30 28z" fill="#fff"/>` +
        `<text x="128" y="62" font-family="Arial,sans-serif" font-size="38" font-weight="800" fill="#8c1d40">MONTESOL</text><text x="130" y="90" font-family="Arial,sans-serif" font-size="16" letter-spacing="4" fill="#5c5c5c">INSTITUTO · DEMO</text>`,
      380,
    ),
  },
]

export const brandingOf = (meta: { branding?: Branding }): Branding => meta.branding ?? DEFAULT_BRANDING
export const placesOf = (meta: { checkinPlaces?: string[] }) => (meta.checkinPlaces?.length ? meta.checkinPlaces : DEFAULT_PLACES)
