import type { Database, ScheduleSlot } from '../data/types'
import { DAYS } from '../lib/format'
import { groupLabel, subjectName, teacherName } from '../lib/scope'
import { EmptyState } from './ui'

/** Horario semanal: columnas por día en escritorio, lista por día en móvil. */
export function ScheduleView({ db, slots, show }: { db: Database; slots: ScheduleSlot[]; show: 'grupo' | 'docente' }) {
  if (slots.length === 0) return <EmptyState icon="horario" title="Sin clases en el horario" />
  const today = new Date().getDay()
  return (
    <div className="grid gap-3 md:grid-cols-5">
      {[1, 2, 3, 4, 5].map((d) => {
        const list = slots.filter((s) => s.day === d).sort((a, b) => a.start.localeCompare(b.start))
        return (
          <section key={d} className={`min-w-0 rounded-2xl border p-3 ${d === today ? 'border-primary bg-info-bg/40' : 'border-line bg-surface'}`}>
            <h3 className="mb-2 flex items-center justify-between text-sm font-bold text-heading">
              {DAYS[d]}
              {d === today && <span className="rounded-full bg-primary px-2 text-xs text-on-primary">Hoy</span>}
            </h3>
            {list.length === 0 ? (
              <p className="text-sm text-muted">Sin clases</p>
            ) : (
              <ul className="space-y-2">
                {list.map((s) => (
                  <li key={s.id} className="rounded-xl border-l-4 border-cyan bg-surface-2 px-3 py-2 text-sm">
                    <p className="text-xs font-semibold text-muted">{s.start} – {s.end}</p>
                    <p className="font-semibold break-words text-heading">{subjectName(db, s.subjectId)}</p>
                    <p className="text-xs break-words text-muted">{show === 'docente' ? groupLabel(db, s.groupId) : teacherName(db, s.teacherId)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
