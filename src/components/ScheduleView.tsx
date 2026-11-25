import type { Database, ScheduleSlot } from '../data/types'
import { DAYS, demoDate } from '../lib/format'
import { groupLabel, subjectName, teacherName } from '../lib/scope'
import { subjectCard } from '../lib/subjects'
import { EmptyState } from './ui'

const RECESS = { start: '10:30', end: '11:00' }

type Item = { kind: 'clase'; slot: ScheduleSlot } | { kind: 'recreo' | 'libre'; start: string; end: string }

/** Intercala el recreo y las horas sin clase para que el horario no tenga huecos sin explicar. */
function withBreaks(list: ScheduleSlot[]): Item[] {
  const out: Item[] = []
  list.forEach((slot, i) => {
    const prev = list[i - 1]
    if (prev && prev.end < slot.start) {
      if (prev.end <= RECESS.start && slot.start >= RECESS.end) {
        if (prev.end < RECESS.start) out.push({ kind: 'libre', start: prev.end, end: RECESS.start })
        out.push({ kind: 'recreo', ...RECESS })
        if (slot.start > RECESS.end) out.push({ kind: 'libre', start: RECESS.end, end: slot.start })
      } else out.push({ kind: 'libre', start: prev.end, end: slot.start })
    }
    out.push({ kind: 'clase', slot })
  })
  return out
}

/** Horario semanal: columnas por día en escritorio, lista por día en móvil. */
export function ScheduleView({ db, slots, show }: { db: Database; slots: ScheduleSlot[]; show: 'grupo' | 'docente' }) {
  if (slots.length === 0) return <EmptyState icon="horario" title="Sin clases en el horario" />
  const today = demoDate().getDay()
  return (
    <div className="grid gap-3 md:grid-cols-5">
      {[1, 2, 3, 4, 5].map((d) => {
        const list = slots.filter((s) => s.day === d).sort((a, b) => a.start.localeCompare(b.start))
        return (
          <section key={d} className={`min-w-0 rounded-2xl border p-3 ${d === today ? 'border-primary bg-info-bg/40' : 'card-tint'}`}>
            <h3 className="mb-2 flex items-center justify-between text-sm font-bold text-heading">
              {DAYS[d]}
              {d === today && <span className="rounded-full bg-primary px-2 text-xs text-on-primary">Hoy</span>}
            </h3>
            {list.length === 0 ? (
              <p className="text-sm text-muted">Sin clases</p>
            ) : (
              <ul className="space-y-2">
                {withBreaks(list).map((item) =>
                  item.kind === 'clase' ? (
                    <li key={item.slot.id} className={`rounded-xl px-3 py-2 text-sm ${subjectCard(db, item.slot.subjectId)}`}>
                      <p className="text-xs font-semibold text-muted">{item.slot.start} – {item.slot.end}</p>
                      <p className="font-semibold break-words text-heading">{subjectName(db, item.slot.subjectId)}</p>
                      <p className="text-xs break-words text-muted">{show === 'docente' ? groupLabel(db, item.slot.groupId) : teacherName(db, item.slot.teacherId)}</p>
                    </li>
                  ) : (
                    <li key={`${d}-${item.start}`} className="rounded-xl border border-dashed border-line px-3 py-1.5 text-xs text-muted">
                      <span className="font-semibold">{item.start} – {item.end}</span> · {item.kind === 'recreo' ? 'Recreo' : 'Sin clase'}
                    </li>
                  ),
                )}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
