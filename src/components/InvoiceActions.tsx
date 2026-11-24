import { useState } from 'react'
import { buildInvoicePdf } from '../cfdi/pdf'
import { download, invoiceFileName } from '../cfdi/service'
import type { Invoice } from '../data/types'
import { canDownloadFiles } from '../lib/env'
import { useApp } from '../state/context'
import { InvoicePreview } from './InvoicePreview'
import { Button, Modal, Notice } from './ui'

/** Ver el XML y la representación impresa (PDF) de una factura, y descargarlos donde se pueda. */
export function InvoiceActions({ invoice }: { invoice: Invoice }) {
  const { db, log } = useApp()
  const [view, setView] = useState<'xml' | 'pdf' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const name = `${invoice.serie}-${invoice.folio}`
  const downloadable = canDownloadFiles()

  const pdf = async () => {
    setBusy(true)
    setError('')
    try {
      const blob = await buildInvoicePdf(invoice, db.meta.school, db.meta.cfdiConfig)
      download(blob, invoiceFileName(invoice, 'pdf'))
      void log({ action: 'Descargó factura PDF', detail: name, kind: 'acceso' })
    } catch {
      setError('No se pudo generar el PDF. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button variant="secundario" icon="ojo" onClick={() => setView('xml')} aria-label={`Ver XML de la factura ${name}`}>
        XML
      </Button>
      <Button variant="secundario" icon="ojo" onClick={() => setView('pdf')} aria-label={`Ver PDF de la factura ${name}`}>
        PDF
      </Button>
      <Modal open={view !== null} onClose={() => setView(null)} title={view === 'xml' ? `XML de la factura ${name}` : `PDF de la factura ${name}`}>
        {view === 'xml' && (
          <pre className="max-h-[55vh] overflow-auto rounded-lg bg-surface-2 p-3 text-xs break-all whitespace-pre-wrap text-ink">{invoice.xml}</pre>
        )}
        {view === 'pdf' && <InvoicePreview invoice={invoice} school={db.meta.school} />}
        <div className="mt-3">
          {downloadable ? (
            view === 'xml' ? (
              <Button
                icon="descargar"
                onClick={() => download(new Blob([invoice.xml], { type: 'application/xml' }), invoiceFileName(invoice, 'xml'))}
                aria-label={`Descargar XML de la factura ${name}`}
              >
                Descargar XML
              </Button>
            ) : (
              <Button icon="descargar" disabled={busy} onClick={() => void pdf()} aria-label={`Descargar PDF de la factura ${name}`}>
                {busy ? 'Generando…' : 'Descargar PDF'}
              </Button>
            )
          ) : (
            <Notice tone="info" icon="descargar">
              En esta vista previa no se pueden descargar archivos. En el producto real, aquí se descarga el {view === 'xml' ? 'XML' : 'PDF'} de la factura.
            </Notice>
          )}
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </div>
      </Modal>
    </div>
  )
}
