import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { DayLog } from '../../components/DayLog'
import { ReportCardButton } from '../../components/ReportCardButton'
import { AccessDenied } from '../../components/guards'
import { ScheduleView } from '../../components/ScheduleView'
import { AttendanceList, GradesTable } from '../../components/StudentRecords'
import { Card, EmptyState, LinkButton, PageHeader, Tabs } from '../../components/ui'
import { formatDate, formatMoney, todayISO } from '../../lib/format'
import { studentBalance } from '../../lib/finance'
import { canSeeStudent, groupLabel, studentName } from '../../lib/scope'
import { useApp } from '../../state/context'
import { SubjectTag } from '../../components/Subject'
import { subjectStripe } from '../../lib/subjects'

type View = 'dia' | 'calificaciones' | 'asistencia' | 'tareas' | 'horario' | 'pagos'

export function ChildPage() {
  const { id = '' } = useParams()
  const { db, session, log } = useApp()
  const [params] = useSearchParams()
  const [view, setView] = useState<View>(params.get('vista') === 'dia' ? 'dia' : 'calificaciones')
  const student = db.students.find((s) => s.id === id)
  const allowed = canSeeStudent(db, session, id)
  const logged = useRef('')
  useEffect(() => {
    if (!allowed || !student || logged.current === id) return
    logged.current = id
    void log({ action: 'Consultó información de su hijo', detail: studentName(student), kind: 'acceso' })
  }, [allowed, student, id, log])

  // Un papá nunca ve alumnos que no sean sus hijos.
  if (!student || !allowed) return <AccessDenied detail={`Portal familiar: alumno ${id}`} />
  const homework = db.homework.filter((h) => h.groupId === student.groupId).sort((a, b) => b.dueDate.localeCompare(a.dueDate))
  const bal = studentBalance(db, student.id)

  return (
    <>
      <PageHeader title={studentName(student)} subtitle={groupLabel(db, student.groupId)} />
      <Tabs label="Información del alumno" value={view} onChange={setView} options={[{ value: 'dia', label: 'Día a día' }, { value: 'calificaciones', label: 'Calificaciones' }, { value: 'asistencia', label: 'Asistencia' }, { value: 'tareas', label: 'Tareas' }, { value: 'horario', label: 'Horario' }, { value: 'pagos', label: 'Pagos' }]} />
      {view === 'dia' && <Card title={`Día a día de ${student.firstName}`} action={<LinkButton to="/familia/qr" variant="secundario" icon="qr">Ver su QR</LinkButton>}><DayLog db={db} studentId={student.id} /></Card>}
      {view === 'calificaciones' && <Card title="Boleta del ciclo 2026-2027" action={<ReportCardButton studentId={student.id} />}><GradesTable db={db} studentId={student.id} /></Card>}
      {view === 'asistencia' && <Card title={`Asistencia de ${student.firstName}`}><AttendanceList db={db} studentId={student.id} limit={20} /></Card>}
      {view === 'tareas' && (
        <Card title="Tareas">
          {homework.length === 0 ? (
            <EmptyState icon="tareas" title="No hay tareas registradas" />
          ) : (
            <ul className="divide-y divide-line">
              {homework.map((h) => (
                <li key={h.id} className="py-3">
                  <div className={subjectStripe(db, h.subjectId)}>
                    <p className="font-semibold text-heading">{h.title}</p>
                    <p className="text-sm text-muted"><SubjectTag db={db} id={h.subjectId} /> · entrega {formatDate(h.dueDate)}{h.dueDate < todayISO() ? ' (ya pasó)' : ''}</p>
                    {h.description && <p className="mt-1 text-sm">{h.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {view === 'horario' && <ScheduleView db={db} slots={db.schedule.filter((s) => s.groupId === student.groupId)} show="grupo" />}
      {view === 'pagos' && (
        <Card title="Resumen de pagos">
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <div className="flex flex-col rounded-xl bg-surface-2 p-3"><dt className="flex-1 text-muted">Total del ciclo</dt><dd className="text-lg font-bold text-heading">{formatMoney(bal.total)}</dd></div>
            <div className="flex flex-col rounded-xl bg-surface-2 p-3"><dt className="flex-1 text-muted">Pagado</dt><dd className="text-lg font-bold text-heading">{formatMoney(bal.paid)}</dd></div>
            <div className="flex flex-col rounded-xl bg-surface-2 p-3"><dt className="flex-1 text-muted">Por pagar</dt><dd className={`text-lg font-bold ${bal.overdue ? 'text-danger' : 'text-heading'}`}>{formatMoney(bal.balance)}</dd></div>
          </dl>
          <LinkButton to={`/pagos/estado/${student.id}`} className="mt-4" icon="pagos">Ver estado de cuenta</LinkButton>
        </Card>
      )}
      <div className="mt-4"><LinkButton to="/familia" variant="fantasma" icon="izquierda">Volver a mis hijos</LinkButton></div>
    </>
  )
}
