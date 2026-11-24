import { useState } from 'react'
import { ScheduleView } from '../../components/ScheduleView'
import { PageHeader, Tabs } from '../../components/ui'
import { plural } from '../../lib/format'
import { groupLabel } from '../../lib/scope'
import { useApp } from '../../state/context'

export function SchedulePage() {
  const { db, session } = useApp()
  const mine = db.schedule.filter((s) => s.teacherId === session.personId)
  const homeroom = db.groups.filter((g) => g.homeroomTeacherId === session.personId)
  const [view, setView] = useState<string>(homeroom[0]?.id ?? 'mias')
  const options = [...homeroom.map((g) => ({ value: g.id, label: `Horario de ${groupLabel(db, g)}` })), { value: 'mias', label: 'Solo mis clases' }]
  const slots = view === 'mias' ? mine : db.schedule.filter((s) => s.groupId === view)
  return (
    <>
      <PageHeader title="Horario" subtitle={view === 'mias' ? `${plural(mine.length, 'clase', 'clases')} a la semana` : 'El mismo horario que ven tus alumnos y sus familias'} />
      {options.length > 1 && <Tabs label="Horario" value={view} onChange={setView} options={options} />}
      <ScheduleView db={db} slots={slots} show={view === 'mias' ? 'docente' : 'grupo'} />
    </>
  )
}
