// Elementos de marca compartidos por los PDF de EDUGRID (facturas y boletas).
import type { jsPDF } from 'jspdf'

export const NAVY: [number, number, number] = [16, 29, 50]
export const CYAN: [number, number, number] = [53, 197, 217]
/** «GRID» sobre la placa blanca: cyan oscurecido para contraste AA de texto grande (3.82:1). */
export const CYAN_TEXT_ON_LIGHT: [number, number, number] = [22, 143, 163]
export const TEXT: [number, number, number] = [36, 50, 71]

export function drawDemoWatermark(doc: jsPDF) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  doc.setTextColor(236, 200, 140)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(110)
  doc.text('DEMO', W / 2, H / 2 + 20, { align: 'center', angle: 35 })
}

/** Banda marino con el logotipo sobre placa blanca (colores originales del manual). */
export function drawBrandHeader(doc: jsPDF) {
  const W = doc.internal.pageSize.getWidth()
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 30, 'F')
  doc.setFillColor(...CYAN)
  doc.rect(0, 30, W, 1.5, 'F')
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(10, 5, 62, 14, 2, 2, 'F')
  const iso = (px: number, py: number) => [14 + px * 0.16, 6.6 + py * 0.16] as const
  doc.setLineCap('round')
  doc.setLineJoin('round')
  doc.setDrawColor(...NAVY)
  doc.setLineWidth(1.05)
  const hex: [number, number][] = [[44, 7.6], [32, 1], [5.7, 16], [5.7, 48], [32, 63], [58.3, 48], [58.3, 26]]
  for (let k = 0; k < hex.length - 1; k++) {
    const [ax, ay] = iso(...hex[k]!)
    const [bx, by] = iso(...hex[k + 1]!)
    doc.line(ax, ay, bx, by)
  }
  doc.setDrawColor(...CYAN)
  doc.setLineWidth(1.45)
  doc.line(...iso(18, 44), ...iso(46, 16))
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...NAVY)
  doc.text('EDU', 28, 15.3)
  doc.setTextColor(...CYAN_TEXT_ON_LIGHT)
  doc.text('GRID', 28 + doc.getTextWidth('EDU'), 15.3)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Una escuela. Todos conectados.', 10, 25)
}
