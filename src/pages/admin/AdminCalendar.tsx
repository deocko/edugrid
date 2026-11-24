import { useState } from 'react'
import { Card, EmptyState, PageHeader, Tabs } from '../../components/ui'
import { formatDate, todayISO } from '../../lib/format'
import { audienceLabel, groupLabel, subjectName } from '../../lib/scope'
import { subjectClass } from '../../lib/subjects'
import { useApp } from '../../state/context'

type Kind = 'evento' | 'periodo' | 'tarea'
interface Item {
  date: string
  title: string
  detail: string
  kind: Kind
  subjectId?: string
}

const monthTitle = (m: string) => {
  const s = new Date(`${m}-15T12:00:00`).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const CHIP: Record<Kind, string> = { evento: 'bg-info-bg text-info', periodo: 'bg-success-bg text-success', tarea: 'bg-warning-bg text-warning' }

/** Calendario de la escuela para la dirección: eventos, inicio y cierre de trimestres y entregas de tareas de todos los grupos. */
export function AdminCalendar() {
  const { db } = useApp()
  const today = todayISO()
  const [view, setView] = useState<'todo' | Kind>('todo')
  const all: Item[] = [
    ...db.events.filter((e) => (e.endDate ?? e.date) >= today).map((e) => ({ date: e.date, title: e.title, detail: `${e.description}${e.endDate ? ` Hasta el ${formatDate(e.endDate)}.` : ''} · ${audienceLabel(db, e.audience)}`, kind: 'evento' as const })),
    ...db.periods.filter((p) => p.cycleId === 'c2026').flatMap((p) => [
      { date: p.startDate, title: `Inicia el ${p.name}`, detail: 'Toda la escuela', kind: 'periodo' as const },
      { date: p.endDate, title: `Cierra el ${p.name}`, detail: 'Fecha límite para cerrar calificaciones', kind: 'periodo' as const },
    ]).filter((i) => i.date >= today),
    ...db.homework.filter((h) => h.dueDate >= today).map((h) => ({ date: h.dueDate, title: h.title, detail: `${groupLabel(db, h.groupId)} · ${subjectName(db, h.subjectId)}`, kind: 'tarea' as const, subjectId: h.subjectId })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind))
  const items = view === 'todo' ? all : all.filter((i) => i.kind === view)
  const months = [...new Set(items.map((i) => i.date.slice(0, 7)))]
  const count = (k: Kind) => all.filter((i) => i.kind === k).length

  return (
    <>
      <PageHeader title="Calendario" subtitle="Eventos de la escuela, trimestres y entregas de tareas de todos los grupos." />
      <Tabs
        label="Mostrar"
        value={view}
        onChange={setView}
        options={[
          { value: 'todo', label: `Todo (${all.length})` },
          { value: 'evento', label: `Eventos (${count('evento')})` },
          { value: 'periodo', label: `Trimestres (${count('periodo')})` },
          { value: 'tarea', label: `Tareas (${count('tarea')})` },
        ]}
      />
      {items.length === 0 ? (
        <EmptyState icon="calendario" title="No hay fechas próximas" />
      ) : (
        <div className="space-y-4">
          {months.map((m) => (
            <Card key={m} title={monthTitle(m)}>
              <ul className="divide-y divide-line">
                {items.filter((i) => i.date.startsWith(m)).map((i, idx) => (
                  <li key={idx} className="flex gap-3 py-2.5">
                    <span className={`flex size-12 shrink-0 flex-col items-center justify-center rounded-xl text-xs font-semibold ${i.subjectId ? `${subjectClass(db, i.subjectId)} border-l-4 border-l-[var(--s)] bg-[var(--s-bg)] text-[var(--s-ink)]` : CHIP[i.kind]}`}>
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
