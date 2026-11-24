// Representación impresa del CFDI en PDF con marca de agua DEMO.
// jsPDF se carga bajo demanda y va empaquetado con la app (sin CDN).
import type { CfdiConfig, Invoice, School } from '../data/types'
import { FORMAS_PAGO, REGIMENES, USOS_CFDI } from './catalogs'
import { amountInWords } from './numberToWords'
import { readAttr } from './xml'
import { CYAN, NAVY, TEXT, drawBrandHeader, drawDemoWatermark } from '../lib/pdfBrand'

export async function buildInvoicePdf(inv: Invoice, school: School, cfg: CfdiConfig): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const x = inv.xml
  const total = Number(readAttr(x, 'cfdi:Comprobante', 'Total'))

  drawDemoWatermark(doc)
  drawBrandHeader(doc)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('FACTURA · CFDI 4.0', W - 14, 13, { align: 'right' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Serie ${inv.serie} · Folio ${inv.folio}`, W - 14, 19, { align: 'right' })
  doc.text(`Fecha: ${inv.fecha.replace('T', ' ')}`, W - 14, 24, { align: 'right' })

  // Banda de aviso DEMO
  doc.setFillColor(253, 241, 220)
  doc.rect(14, 36, W - 28, 10, 'F')
  doc.setTextColor(138, 83, 0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('DOCUMENTO DEMO SIN VALIDEZ FISCAL · No fue timbrado por un PAC ni reportado al SAT', W / 2, 42.5, { align: 'center' })

  // Emisor y receptor
  const block = (title: string, lines: string[], bx: number, by: number, bw: number) => {
    doc.setTextColor(...NAVY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(title, bx, by)
    doc.setTextColor(...TEXT)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    let yy = by + 5
    for (const l of lines) {
      const wrapped = doc.splitTextToSize(l, bw) as string[]
      doc.text(wrapped, bx, yy)
      yy += wrapped.length * 4
    }
    return yy
  }
  const regE = readAttr(x, 'cfdi:Emisor', 'RegimenFiscal')
  const regR = readAttr(x, 'cfdi:Receptor', 'RegimenFiscalReceptor')
  const uso = readAttr(x, 'cfdi:Receptor', 'UsoCFDI')
  const y1 = block('Emisor', [readAttr(x, 'cfdi:Emisor', 'Nombre'), `RFC: ${readAttr(x, 'cfdi:Emisor', 'Rfc')}`, `Régimen: ${regE} ${REGIMENES[regE] ?? ''}`, `Lugar de expedición: ${readAttr(x, 'cfdi:Comprobante', 'LugarExpedicion')}`, school.address], 14, 54, 85)
  const y2 = block('Receptor', [readAttr(x, 'cfdi:Receptor', 'Nombre'), `RFC: ${readAttr(x, 'cfdi:Receptor', 'Rfc')}`, `Domicilio fiscal (CP): ${readAttr(x, 'cfdi:Receptor', 'DomicilioFiscalReceptor')}`, `Régimen: ${regR} ${REGIMENES[regR] ?? ''}`, `Uso CFDI: ${uso} ${USOS_CFDI[uso] ?? ''}`], 110, 54, 90)
  let y = Math.max(y1, y2) + 4

  // Conceptos
  doc.setFillColor(...NAVY)
  doc.rect(14, y, W - 28, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Clave', 16, y + 5.3)
  doc.text('Cant.', 36, y + 5.3)
  doc.text('Unidad', 48, y + 5.3)
  doc.text('Descripción', 66, y + 5.3)
  doc.text('Importe', W - 16, y + 5.3, { align: 'right' })
  y += 13
  doc.setTextColor(...TEXT)
  doc.setFont('helvetica', 'normal')
  doc.text(readAttr(x, 'cfdi:Concepto', 'ClaveProdServ'), 16, y)
  doc.text('1', 36, y)
  doc.text(readAttr(x, 'cfdi:Concepto', 'ClaveUnidad'), 48, y)
  const desc = doc.splitTextToSize(`${readAttr(x, 'cfdi:Concepto', 'Descripcion')}. Objeto de impuesto: 02. IVA exento (servicios educativos).`, 100) as string[]
  doc.text(desc, 66, y)
  doc.text(`$${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, W - 16, y, { align: 'right' })
  y += desc.length * 4 + 2
  const alumno = readAttr(x, 'iedu:instEducativas', 'nombreAlumno')
  if (alumno) {
    doc.setFontSize(7.5)
    doc.text(`Complemento IEDU · Alumno: ${alumno} · CURP: ${readAttr(x, 'iedu:instEducativas', 'CURP')} · Nivel: ${readAttr(x, 'iedu:instEducativas', 'nivelEducativo')} · RVOE: ${readAttr(x, 'iedu:instEducativas', 'autRVOE')}`, 66, y, { maxWidth: W - 82 })
    y += 9
  }
  doc.setDrawColor(211, 220, 232)
  doc.line(14, y, W - 14, y)
  y += 7

  // Totales
  doc.setFontSize(9)
  const fp = readAttr(x, 'cfdi:Comprobante', 'FormaPago')
  doc.text(`Forma de pago: ${fp} ${FORMAS_PAGO[fp] ?? ''}`, 14, y)
  doc.text('Método de pago: PUE Pago en una sola exhibición', 14, y + 5)
  doc.text('Moneda: MXN Peso mexicano', 14, y + 10)
  doc.text(`Subtotal: $${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, W - 14, y, { align: 'right' })
  doc.text('IVA: Exento', W - 14, y + 5, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...NAVY)
  doc.setFontSize(12)
  doc.text(`Total: $${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, W - 14, y + 12, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...TEXT)
  doc.text(amountInWords(total), 14, y + 18)
  y += 28

  // Timbre
  doc.setDrawColor(...CYAN)
  doc.setLineWidth(0.6)
  doc.rect(14, y, 34, 34)
  doc.setFontSize(7)
  doc.text(['Código QR', 'no disponible', 'en modo demo'], 31, y + 14, { align: 'center' })
  const tx = 54
  const tw = W - 14 - tx
  const pair = (label: string, value: string, yy: number) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label, tx, yy)
    doc.setFont('helvetica', 'normal')
    const v = doc.splitTextToSize(value, tw) as string[]
    doc.text(v, tx, yy + 3.5)
    return yy + 3.5 + v.length * 3
  }
  doc.setFontSize(7)
  let ty = pair('Folio fiscal (UUID)', `${inv.uuid} (DEMO)`, y + 2)
  ty = pair('Fecha de timbrado', inv.fechaTimbrado.replace('T', ' '), ty + 1)
  ty = pair('RFC del PAC · No. certificado SAT', `${readAttr(x, 'tfd:TimbreFiscalDigital', 'RfcProvCertif')} · ${readAttr(x, 'tfd:TimbreFiscalDigital', 'NoCertificadoSAT')}`, ty + 1)
  ty = pair('Sello digital del CFDI', readAttr(x, 'cfdi:Comprobante', 'Sello'), ty + 1)
  ty = pair('Sello del SAT', readAttr(x, 'tfd:TimbreFiscalDigital', 'SelloSAT'), ty + 1)
  y = Math.max(ty, y + 36) + 4
  if (inv.status === 'cancelada') {
    doc.setTextColor(179, 38, 30)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('CANCELADA (DEMO)', W / 2, y + 4, { align: 'center' })
    y += 10
  }
  doc.setTextColor(...TEXT)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(`Este documento es una representación impresa de un CFDI de demostración generado por EDUGRID para ${school.name} (escuela ficticia). Serie configurada: ${cfg.serie}.`, 14, H - 12, { maxWidth: W - 28 })
  return doc.output('blob')
}
