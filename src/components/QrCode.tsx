import { useMemo } from 'react'
import { qrMatrix } from '../lib/qr'

/** Código QR en SVG (siempre negro sobre blanco para que cualquier lector lo lea). */
export function QrCode({ value, size = 240, label }: { value: string; size?: number; label: string }) {
  const { n, d } = useMemo(() => {
    const m = qrMatrix(value)
    let path = ''
    m.forEach((row, r) => row.forEach((dark, c) => { if (dark) path += `M${c + 4} ${r + 4}h1v1h-1z` }))
    return { n: m.length + 8, d: path }
  }, [value])
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} role="img" aria-label={label} shapeRendering="crispEdges" className="rounded-xl">
      <rect width={n} height={n} fill="#ffffff" />
      <path d={d} fill="#000000" />
    </svg>
  )
}
