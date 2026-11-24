// Elementos de marca compartidos por los PDF de EDUGRID (facturas y boletas).
import type { jsPDF } from 'jspdf'
import { LOGO_CYAN, LOGO_CYAN_D, LOGO_NAVY, LOGO_NAVY_D, LOGO_VIEWBOX } from '../brand/logoPaths'

export const NAVY: [number, number, number] = [16, 29, 50]
export const CYAN: [number, number, number] = [53, 197, 217]
export const TEXT: [number, number, number] = [36, 50, 71]

export function drawDemoWatermark(doc: jsPDF) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  doc.setTextColor(236, 200, 140)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(110)
  doc.text('DEMO', W / 2, H / 2 + 20, { align: 'center', angle: 35 })
}

type PathOp = { op: 'm' | 'l' | 'c' | 'h'; c: number[] }

/** Convierte los trazos del logotipo (solo M, L, C y Z absolutos) en operaciones de jsPDF. */
function toOps(d: string, scale: number, dx: number, dy: number): PathOp[] {
  const ops: PathOp[] = []
  const re = /([MLCZ])([^MLCZ]*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(d))) {
    const n = (m[2] ?? '').trim().split(/[\s,]+/).filter(Boolean).map(Number)
    const pts = n.map((v, i) => (i % 2 === 0 ? dx + v * scale : dy + v * scale))
    if (m[1] === 'M') ops.push({ op: 'm', c: pts })
    else if (m[1] === 'L') ops.push({ op: 'l', c: pts })
    else if (m[1] === 'C') ops.push({ op: 'c', c: pts })
    else ops.push({ op: 'h', c: [] })
  }
  return ops
}

/** Logotipo oficial del manual, en vector. tone «invertida» para fondos oscuros. */
export function drawLogo(doc: jsPDF, x: number, y: number, width: number, tone: 'color' | 'invertida' = 'color') {
  const scale = width / LOGO_VIEWBOX.w
  const ink: [number, number, number] = tone === 'invertida' ? [255, 255, 255] : hex(LOGO_NAVY)
  doc.setFillColor(...ink)
  doc.path(toOps(LOGO_NAVY_D, scale, x, y))
  doc.fillEvenOdd()
  doc.setFillColor(...hex(LOGO_CYAN))
  doc.path(toOps(LOGO_CYAN_D, scale, x, y))
  doc.fillEvenOdd()
}

function hex(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}

/** Banda marino con el logotipo oficial en su versión invertida (como indica el manual para fondos oscuros). */
export function drawBrandHeader(doc: jsPDF) {
  const W = doc.internal.pageSize.getWidth()
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 30, 'F')
  doc.setFillColor(...CYAN)
  doc.rect(0, 30, W, 1.5, 'F')
  drawLogo(doc, 10, 6, 52, 'invertida')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Una escuela. Todos conectados.', 10, 25)
}
