import { ScheduleView } from '../../components/ScheduleView'
import { PageHeader } from '../../components/ui'
import { useApp } from '../../state/context'

export function SchedulePage() {
  const { db, session } = useApp()
  const slots = db.schedule.filter((s) => s.teacherId === session.personId)
  return (
    <>
      <PageHeader title="Mi horario" subtitle={`${slots.length} clases a la semana`} />
      <ScheduleView db={db} slots={slots} show="docente" />
    </>
  )
}
