import { nowISO } from '../lib/format'
import type { Database, Invoice, Payment } from '../data/types'
import { levelOfGroup, studentName } from '../lib/scope'
import { RFC_PUBLICO_GENERAL } from './catalogs'
import { getPacAdapter } from './pac'
import { buildCfdiXml, type CfdiInput } from './xml'

export interface ReceptorInput {
  rfc: string
  nombre: string
  cp: string
  regimen: string
  uso: string
}

const FORMA: Record<Payment['method'], string> = { efectivo: '01', transferencia: '03', tarjeta: '04' }

const localNow = () => nowISO()

/** Arma el CFDI, lo manda timbrar al PAC configurado y devuelve la factura lista para guardar. */
export async function emitInvoice(db: Database, payment: Payment, receptor: ReceptorInput, id: string): Promise<Invoice> {
  const cfg = db.meta.cfdiConfig
  const charge = db.charges.find((c) => c.id === payment.chargeId)
  const concept = db.concepts.find((c) => c.id === charge?.conceptId)
  const student = db.students.find((s) => s.id === payment.studentId)
  if (!charge || !concept || !student) throw new Error('No se encontró el cargo del pago.')
  const level = levelOfGroup(db, student.groupId) ?? 'primaria'
  const educativo = concept.kind !== 'otro'
  const publico = receptor.rfc === RFC_PUBLICO_GENERAL
  const input: CfdiInput = {
    serie: cfg.serie,
    folio: cfg.nextFolio,
    fecha: localNow(),
    formaPago: FORMA[payment.method],
    lugarExpedicion: cfg.codigoPostal,
    emisor: { rfc: cfg.rfcEmisor, nombre: cfg.razonSocial, regimenFiscal: cfg.regimenFiscal },
    receptor: {
      rfc: receptor.rfc,
      nombre: publico ? 'PUBLICO EN GENERAL' : receptor.nombre.toUpperCase(),
      domicilioFiscal: publico ? cfg.codigoPostal : receptor.cp,
      regimenFiscal: publico ? '616' : receptor.regimen,
      usoCfdi: publico ? 'S01' : receptor.uso,
    },
    concepto: {
      claveProdServ: concept.satProductCode,
      claveUnidad: concept.satUnitCode,
      descripcion: `${charge.description} - ${studentName(student)}`,
      importe: payment.amount,
      alumno: educativo ? { nombre: studentName(student), curp: student.curp, nivel: level, rvoe: db.meta.school.rvoe } : null,
    },
  }
  const pac = getPacAdapter(cfg.pacProvider)
  const res = await pac.timbrar(buildCfdiXml(input))
  return {
    id,
    paymentId: payment.id,
    studentId: student.id,
    serie: input.serie,
    folio: input.folio,
    uuid: res.uuid,
    fecha: input.fecha,
    fechaTimbrado: res.fechaTimbrado,
    total: payment.amount,
    receptorRfc: input.receptor.rfc,
    receptorNombre: input.receptor.nombre,
    xml: res.xmlTimbrado,
    status: 'vigente',
    demo: true,
  }
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const invoiceFileName = (inv: Invoice, ext: 'xml' | 'pdf') => `${inv.serie}-${inv.folio}-${inv.uuid.slice(0, 8)}.${ext}`
