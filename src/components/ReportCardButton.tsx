import { useEffect, useState } from 'react'
import { canDownloadFiles, embeddedDownloads, saveFile } from '../lib/env'
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
  // En una vista previa incrustada, se pide de antemano el permiso de guardar archivos para que el clic responda rápido.
  useEffect(() => {
    if (!canDownloadFiles()) void embeddedDownloads()
  }, [])
  const run = async () => {
    setBusy(true)
    setError('')
    try {
      const blob = await buildReportCardPdf(db, studentId)
      const result = await saveFile(blob, `Boleta-DEMO-${student?.enrollmentId ?? studentId}.pdf`)
      if (result === 'ok') void log({ action: 'Descargó boleta', detail: studentName(student), kind: 'acceso' })
      else if (result === 'no-disponible') setError('En esta vista previa no se pueden descargar archivos. En el producto real, aquí se descarga tu boleta en PDF.')
      else setError('No se guardó la boleta. Puedes intentarlo de nuevo.')
    } catch {
      setError('No se pudo generar la boleta.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-2">
      <Button variant="secundario" icon="descargar" disabled={busy} onClick={() => void run()}>
        {busy ? 'Generando…' : 'Descargar boleta (PDF)'}
      </Button>
      {error && (
        <span role="status" className="block w-full rounded-lg bg-info-bg px-3 py-2 text-sm text-info">
          {error}
        </span>
      )}
    </span>
  )
}
