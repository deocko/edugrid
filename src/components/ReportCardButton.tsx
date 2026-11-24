import { useState } from 'react'
import { download } from '../cfdi/service'
import { buildReportCardPdf } from '../lib/reportCard'
import { studentName } from '../lib/scope'
import { useApp } from '../state/context'
import { Button } from './ui'

/** Descarga la boleta en PDF. Solo se muestra en pantallas que ya validaron el acceso al alumno. */
export function ReportCardButton({ studentId }: { studentId: string }) {
  const { db, log } = useApp()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const student = db.students.find((s) => s.id === studentId)
  const run = async () => {
    setBusy(true)
    setError('')
    try {
      const blob = await buildReportCardPdf(db, studentId)
      download(blob, `Boleta-DEMO-${student?.enrollmentId ?? studentId}.pdf`)
      void log({ action: 'Descargó boleta', detail: studentName(student), kind: 'acceso' })
    } catch {
      setError('No se pudo generar la boleta.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button variant="secundario" icon="descargar" disabled={busy} onClick={() => void run()}>
        {busy ? 'Generando…' : 'Descargar boleta (PDF)'}
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  )
}
