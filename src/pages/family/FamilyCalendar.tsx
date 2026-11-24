import { useState } from 'react'
import { Card, EmptyState, PageHeader, Tabs } from '../../components/ui'
import { formatDate, todayISO } from '../../lib/format'
import { audienceLabel, groupLabel, studentName, subjectName, visibleEvents, visibleStudents } from '../../lib/scope'
import { useApp } from '../../state/context'

interface Item {
  date: string
  title: string
  detail: string
  kind: 'evento' | 'tarea'
}

const monthTitle = (m: string) => {
  const s = new Date(`${m}-15T12:00:00`).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function FamilyCalendar() {
  const { db, session } = useApp()
  const kids = visibleStudents(db, session)
  const today = todayISO()
  const [who, setWho] = useState('todos')
  const shown = who === 'todos' ? kids : kids.filter((k) => k.id === who)
  const items: Item[] = [
    ...visibleEvents(db, session).filter((e) => (e.endDate ?? e.date) >= today).map((e) => ({ date: e.date, title: e.title, detail: `${e.description}${e.endDate ? ` Hasta el ${formatDate(e.endDate)}.` : ''} · ${audienceLabel(db, e.audience)}`, kind: 'evento' as const })),
    ...shown.flatMap((k) => db.homework.filter((h) => h.groupId === k.groupId && h.dueDate >= today).map((h) => ({ date: h.dueDate, title: `${k.firstName}: ${h.title}`, detail: `Tarea de ${subjectName(db, h.subjectId)} · ${groupLabel(db, k.groupId)}`, kind: 'tarea' as const }))),
  ].sort((a, b) => a.date.localeCompare(b.date))
  const months = [...new Set(items.map((i) => i.date.slice(0, 7)))]

  return (
    <>
      <PageHeader title="Calendario" subtitle="Eventos de la escuela y entregas de tareas de tus hijos." />
      {kids.length > 1 && (
        <Tabs label="Ver calendario de" value={who} onChange={setWho} options={[{ value: 'todos', label: 'Todos' }, ...kids.map((k) => ({ value: k.id, label: studentName(k) }))]} />
      )}
      {items.length === 0 ? (
        <EmptyState icon="calendario" title="No hay fechas próximas" />
      ) : (
        <div className="space-y-4">
          {months.map((m) => (
            <Card key={m} title={monthTitle(m)}>
              <ul className="divide-y divide-line">
                {items.filter((i) => i.date.startsWith(m)).map((i, idx) => (
                  <li key={idx} className="flex gap-3 py-2.5">
                    <span className={`flex size-12 shrink-0 flex-col items-center justify-center rounded-xl text-xs font-semibold ${i.kind === 'evento' ? 'bg-info-bg text-info' : 'bg-warning-bg text-warning'}`}>
                      <span className="text-lg leading-none font-extrabold">{Number(i.date.slice(8, 10))}</span>
                      {new Date(`${i.date}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'short' })}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-heading">{i.title}</p>
                      <p className="text-sm text-muted">{i.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
