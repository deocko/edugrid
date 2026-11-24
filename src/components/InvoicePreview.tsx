// Representación impresa de la factura en pantalla: muestra lo mismo que el PDF.
import { FORMAS_PAGO, REGIMENES, USOS_CFDI } from '../cfdi/catalogs'
import { amountInWords } from '../cfdi/numberToWords'
import { readAttr } from '../cfdi/xml'
import type { Invoice, School } from '../data/types'
import { formatMoney } from '../lib/format'
import { Logo } from '../brand/Logo'

export function InvoicePreview({ invoice, school }: { invoice: Invoice; school: School }) {
  const x = invoice.xml
  const total = Number(readAttr(x, 'cfdi:Comprobante', 'Total'))
  const fp = readAttr(x, 'cfdi:Comprobante', 'FormaPago')
  const regE = readAttr(x, 'cfdi:Emisor', 'RegimenFiscal')
  const regR = readAttr(x, 'cfdi:Receptor', 'RegimenFiscalReceptor')
  const uso = readAttr(x, 'cfdi:Receptor', 'UsoCFDI')
  const alumno = readAttr(x, 'iedu:instEducativas', 'nombreAlumno')
  return (
    <article className="relative overflow-hidden rounded-xl border border-line bg-white text-[#243247]" aria-label={`Vista previa de la factura ${invoice.serie}-${invoice.folio}`}>
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center text-[5.5rem] font-black text-[#ecc88c]/50 select-none" style={{ transform: 'rotate(-30deg)' }}>
        DEMO
      </span>
      <header className="flex flex-wrap items-center justify-between gap-2 bg-[#101D32] px-4 py-3 text-white">
        <Logo height={24} tone="invertida" />
        <div className="text-right text-xs">
          <p className="text-sm font-bold">Factura electrónica (CFDI 4.0)</p>
          <p>{invoice.serie}-{invoice.folio} · {invoice.fecha.replace('T', ' ')}</p>
        </div>
      </header>
      <div className="relative space-y-3 p-4 text-sm">
        <p className="rounded-lg bg-[#fdf1dc] px-3 py-2 text-center text-xs font-bold text-[#8a5300]">DOCUMENTO DEMO SIN VALIDEZ FISCAL · No se timbró con un PAC real ni se envió al SAT</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <section>
            <h3 className="font-bold text-[#101D32]">Emisor</h3>
            <p>{readAttr(x, 'cfdi:Emisor', 'Nombre')}</p>
            <p>RFC: {readAttr(x, 'cfdi:Emisor', 'Rfc')}</p>
            <p>Régimen: {regE} {REGIMENES[regE]}</p>
            <p className="text-xs">{school.address}</p>
          </section>
          <section>
            <h3 className="font-bold text-[#101D32]">Receptor</h3>
            <p>{readAttr(x, 'cfdi:Receptor', 'Nombre')}</p>
            <p>RFC: {readAttr(x, 'cfdi:Receptor', 'Rfc')} · CP {readAttr(x, 'cfdi:Receptor', 'DomicilioFiscalReceptor')}</p>
            <p>Régimen: {regR} {REGIMENES[regR]}</p>
            <p>Uso: {uso} {USOS_CFDI[uso]}</p>
          </section>
        </div>
        <section className="rounded-lg border border-[#d3dce8] p-3">
          <p className="font-semibold text-[#101D32]">{readAttr(x, 'cfdi:Concepto', 'Descripcion')}</p>
          <p className="text-xs">Clave {readAttr(x, 'cfdi:Concepto', 'ClaveProdServ')} · Unidad {readAttr(x, 'cfdi:Concepto', 'ClaveUnidad')} · IVA exento (servicios educativos)</p>
          {alumno && <p className="text-xs">Alumno: {alumno} · Nivel: {readAttr(x, 'iedu:instEducativas', 'nivelEducativo')}</p>}
        </section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="text-xs">
            <p>Forma de pago: {fp} {FORMAS_PAGO[fp]}</p>
            <p>Método: PUE (pago en una sola exhibición)</p>
            <p>{amountInWords(total)}</p>
          </div>
          <p className="text-lg font-extrabold text-[#101D32]">Total {formatMoney(total)}</p>
        </div>
        <section className="text-xs break-all">
          <p><strong>Folio fiscal (UUID):</strong> {invoice.uuid} (DEMO)</p>
          <p><strong>Timbrado por:</strong> PAC DEMO ({readAttr(x, 'tfd:TimbreFiscalDigital', 'RfcProvCertif')}) el {invoice.fechaTimbrado.replace('T', ' ')}</p>
          <p><strong>Sello digital:</strong> {readAttr(x, 'cfdi:Comprobante', 'Sello').slice(0, 90)}…</p>
        </section>
        {invoice.status === 'cancelada' && <p className="text-center text-base font-bold text-[#b3261e]">CANCELADA (DEMO)</p>}
      </div>
    </article>
  )
}
