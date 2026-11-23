// Construcción del XML CFDI 4.0 (Anexo 20). En modo demo el sello y el
// certificado son ficticios, así que el documento NO tiene validez fiscal.
import { NIVEL_IEDU, RFC_PUBLICO_GENERAL } from './catalogs'

export interface CfdiInput {
  serie: string
  folio: number
  fecha: string
  formaPago: string
  lugarExpedicion: string
  emisor: { rfc: string; nombre: string; regimenFiscal: string }
  receptor: { rfc: string; nombre: string; domicilioFiscal: string; regimenFiscal: string; usoCfdi: string }
  concepto: {
    claveProdServ: string
    claveUnidad: string
    descripcion: string
    importe: number
    alumno?: { nombre: string; curp: string; nivel: string; rvoe: string } | null
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;')
const m = (n: number) => n.toFixed(2)

/** Cadena original simplificada (en un PAC real se genera con la XSLT oficial del SAT). */
export function cadenaOriginal(i: CfdiInput) {
  const c = i.concepto
  return `||4.0|${i.serie}|${i.folio}|${i.fecha}|${i.formaPago}|00000000000000000000|${m(c.importe)}|MXN|${m(c.importe)}|I|01|PUE|${i.lugarExpedicion}|${i.emisor.rfc}|${i.emisor.nombre}|${i.emisor.regimenFiscal}|${i.receptor.rfc}|${i.receptor.nombre}|${i.receptor.domicilioFiscal}|${i.receptor.regimenFiscal}|${i.receptor.usoCfdi}|${c.claveProdServ}|1|${c.claveUnidad}|${c.descripcion}|${m(c.importe)}|${m(c.importe)}|02|${m(c.importe)}|002|Exento||`
}

export function buildCfdiXml(i: CfdiInput): string {
  const c = i.concepto
  const sello = `DEMO${btoa(cadenaOriginal(i).slice(0, 120).normalize('NFD').replace(/[^\x20-\x7e]/g, '')).slice(0, 160)}`
  const iedu =
    c.alumno && NIVEL_IEDU[c.alumno.nivel] && i.receptor.rfc !== RFC_PUBLICO_GENERAL
      ? `
      <cfdi:ComplementoConcepto>
        <iedu:instEducativas version="1.0" nombreAlumno="${esc(c.alumno.nombre)}" CURP="${esc(c.alumno.curp)}" nivelEducativo="${esc(NIVEL_IEDU[c.alumno.nivel] ?? '')}" autRVOE="${esc(c.alumno.rvoe)}" rfcPago="${esc(i.receptor.rfc)}"/>
      </cfdi:ComplementoConcepto>`
      : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- DOCUMENTO DEMO SIN VALIDEZ FISCAL. Generado por EDUGRID en modo demostración: sello, certificado y timbre son ficticios. -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:iedu="http://www.sat.gob.mx/iedu" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd http://www.sat.gob.mx/iedu http://www.sat.gob.mx/sitio_internet/cfd/iedu/iedu.xsd" Version="4.0" Serie="${esc(i.serie)}" Folio="${i.folio}" Fecha="${i.fecha}" Sello="${sello}" FormaPago="${i.formaPago}" NoCertificado="00000000000000000000" Certificado="DEMO-SIN-CERTIFICADO" SubTotal="${m(c.importe)}" Moneda="MXN" Total="${m(c.importe)}" TipoDeComprobante="I" Exportacion="01" MetodoPago="PUE" LugarExpedicion="${esc(i.lugarExpedicion)}">
  <cfdi:Emisor Rfc="${esc(i.emisor.rfc)}" Nombre="${esc(i.emisor.nombre)}" RegimenFiscal="${i.emisor.regimenFiscal}"/>
  <cfdi:Receptor Rfc="${esc(i.receptor.rfc)}" Nombre="${esc(i.receptor.nombre)}" DomicilioFiscalReceptor="${esc(i.receptor.domicilioFiscal)}" RegimenFiscalReceptor="${i.receptor.regimenFiscal}" UsoCFDI="${i.receptor.usoCfdi}"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="${c.claveProdServ}" Cantidad="1" ClaveUnidad="${c.claveUnidad}" Unidad="Unidad de servicio" Descripcion="${esc(c.descripcion)}" ValorUnitario="${m(c.importe)}" Importe="${m(c.importe)}" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="${m(c.importe)}" Impuesto="002" TipoFactor="Exento"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>${iedu}
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos>
    <cfdi:Traslados>
      <cfdi:Traslado Base="${m(c.importe)}" Impuesto="002" TipoFactor="Exento"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
</cfdi:Comprobante>
`
}

/** Lee atributos de un XML ya timbrado (para la representación impresa). */
export function readAttr(xml: string, tag: string, attr: string): string {
  const el = new RegExp(`<${tag}\\b[^>]*>`).exec(xml)?.[0] ?? ''
  return new RegExp(`\\b${attr}="([^"]*)"`).exec(el)?.[1] ?? ''
}
