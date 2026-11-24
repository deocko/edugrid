import { useEffect } from 'react'
import { brandCss, brandingOf, brandTokens } from '../lib/branding'
import { useStore } from '../state/context'
import type { Meta } from '../data/types'
import { Logo } from './Logo'

const useMeta = (): Meta | null => useStore().db?.meta ?? null

/** Aplica los colores de la escuela a toda la app (y al color de la barra del navegador). */
export function BrandStyle() {
  const meta = useMeta()
  const b = brandingOf(meta ?? {})
  const css = brandCss(b)
  const shortName = meta?.school.shortName ?? ''
  const logo = !!b.logo
  const nav = css ? brandTokens(b).nav : '#101D32'
  useEffect(() => {
    document.title = logo ? `${shortName} · by EDUGRID` : 'EDUGRID · Administra tu Escuela'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', nav)
  }, [logo, nav, shortName])
  return css ? <style data-marca-escuela>{css}</style> : null
}

/**
 * Logo del encabezado: el de la escuela si lo cargó; si no, el de EDUGRID.
 * Los logos de escuela suelen venir para fondo blanco, así que en fondos oscuros van sobre una placa clara.
 */
export function SchoolLogo({ height = 28, onDark = false }: { height?: number; onDark?: boolean }) {
  const meta = useMeta()
  const b = brandingOf(meta ?? {})
  if (!b.logo) return <Logo height={height} tone={onDark ? 'invertida' : 'auto'} />
  return (
    <span className={`inline-flex items-center ${onDark ? 'rounded-xl bg-white px-2 py-1' : 'dark:rounded-lg dark:bg-white dark:px-1.5 dark:py-0.5'}`}>
      <img src={b.logo} alt={meta?.school.name ?? 'Logo de la escuela'} style={{ height, maxWidth: height * 5 }} className="block object-contain" />
    </span>
  )
}

/** Firma «by EDUGRID» para el pie de página cuando la escuela usa su propia marca. */
export function ByEdugrid({ onDark = false, className = '' }: { onDark?: boolean; className?: string }) {
  const meta = useMeta()
  if (!brandingOf(meta ?? {}).logo) return null
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${onDark ? 'text-nav-ink' : 'text-muted'} ${className}`}>
      by
      <span className="sr-only">EDUGRID</span>
      <span aria-hidden="true" className="inline-flex items-center">
        <Logo height={14} tone={onDark ? 'invertida' : 'auto'} />
      </span>
    </span>
  )
}
