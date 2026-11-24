// Día a día de un alumno: entradas y salidas con QR y novedades que envía su docente.
import type { Database } from '../data/types'
import { formatDate, todayISO } from '../lib/format'
import { UPDATE_LABEL } from '../lib/updates'
import { Badge, EmptyState } from './ui'


type Entry = { at: string; kind: 'entrada' | 'salida' | 'estatus'; title: string; detail: string; photo?: string | null }

export function DayLog({ db, studentId, days = 7 }: { db: Database; studentId: string; days?: number }) {
  const since = new Date(`${todayISO()}T12:00:00`)
  since.setDate(since.getDate() - days)
  const from = since.toISOString().slice(0, 10)
  const entries: Entry[] = [
    ...db.checkins.filter((c) => c.studentId === studentId && c.date >= from).map((c) => ({ at: c.at, kind: c.type, title: c.type === 'entrada' ? 'Entrada' : 'Salida', detail: `${c.place} · registró ${c.scannedByName}` })),
    ...db.studentUpdates.filter((u) => u.studentId === studentId && u.at.slice(0, 10) >= from).map((u) => ({ at: u.at, kind: 'estatus' as const, title: UPDATE_LABEL[u.category], detail: `${u.text} · ${u.teacherName}`, photo: u.photo })),
  ].sort((a, b) => b.at.localeCompare(a.at))
  if (entries.length === 0) return <EmptyState icon="calendario" title="Sin registros esta semana">Aquí aparecen sus entradas, salidas y las novedades que envía su docente.</EmptyState>
  const daysList = [...new Set(entries.map((e) => e.at.slice(0, 10)))]
  return (
    <div className="space-y-5">
      {daysList.map((d) => (
        <section key={d}>
          <h3 className="mb-2 text-sm font-bold text-heading">{d === todayISO() ? 'Hoy' : formatDate(d)}</h3>
          <ol className="space-y-2">
            {entries.filter((e) => e.at.startsWith(d)).map((e, i) => (
              <li key={i} className="flex gap-3 rounded-xl bg-surface-2 p-3">
                <span className="w-12 shrink-0 pt-0.5 text-sm font-bold tabular-nums text-heading">{e.at.slice(11, 16)}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-heading">
                    {e.title}
                    {e.kind !== 'estatus' && <Badge tone={e.kind === 'entrada' ? 'exito' : 'info'}>QR</Badge>}
                  </p>
                  <p className="text-sm text-muted">{e.detail}</p>
                  {e.photo && <img src={e.photo} alt={`Foto enviada por su docente: ${e.title}`} className="mt-2 max-h-72 w-full rounded-xl object-cover sm:w-auto" />}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}
