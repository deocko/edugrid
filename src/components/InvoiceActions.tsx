import { useState } from 'react'
import { buildInvoicePdf } from '../cfdi/pdf'
import { download, invoiceFileName } from '../cfdi/service'
import type { Invoice } from '../data/types'
import { useApp } from '../state/context'
import { Button } from './ui'

export function InvoiceActions({ invoice }: { invoice: Invoice }) {
  const { db, log } = useApp()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pdf = async () => {
    setBusy(true)
    setError('')
    try {
      const blob = await buildInvoicePdf(invoice, db.meta.school, db.meta.cfdiConfig)
      download(blob, invoiceFileName(invoice, 'pdf'))
      void log({ action: 'Descargó factura PDF', detail: `${invoice.serie}${invoice.folio}`, kind: 'acceso' })
    } catch {
      setError('No se pudo generar el PDF. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button variant="secundario" icon="descargar" onClick={() => download(new Blob([invoice.xml], { type: 'application/xml' }), invoiceFileName(invoice, 'xml'))} aria-label={`Descargar XML de la factura ${invoice.serie}${invoice.folio}`}>
        XML
      </Button>
      <Button variant="secundario" icon="descargar" disabled={busy} onClick={() => void pdf()} aria-label={`Descargar PDF de la factura ${invoice.serie}${invoice.folio}`}>
        {busy ? 'Generando…' : 'PDF'}
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )
}
