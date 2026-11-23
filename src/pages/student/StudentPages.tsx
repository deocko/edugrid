import { Link } from 'react-router'
import { ScheduleView } from '../../components/ScheduleView'
import { GradesTable } from '../../components/StudentRecords'
import { Card, EmptyState, PageHeader, Stat } from '../../components/ui'
import { attendanceSummary } from '../../lib/attendance'
import { DAYS, formatDate, todayISO } from '../../lib/format'
import { averageFor, groupLabel, levelOfGroup, subjectName, visibleAnnouncements } from '../../lib/scope'
import { useApp } from '../../state/context'

/** El alumno solo ve lo suyo: la sesión apunta a su propio registro. */
function useMe() {
  const { db, session } = useApp()
  const me = db.students.find((s) => s.id === session.personId)
  const level = me ? levelOfGroup(db, me.groupId) : undefined
  // En primaria la vista es más sencilla: textos más grandes y menos datos a la vez.
  const simple = level === 'primaria'
  return { db, session, me, level, simple }
}

function HomeworkList({ limit }: { limit?: number }) {
  const { db, me, simple } = useMe()
  if (!me) return null
  const today = todayISO()
  const list = db.homework.filter((h) => h.groupId === me.groupId && h.dueDate >= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, limit)
  if (list.length === 0) return <EmptyState icon="tareas" title="¡No tienes tareas pendientes!" />
  return (
    <ul className={simple ? 'space-y-3' : 'divide-y divide-line'}>
      {list.map((h) => (
        <li key={h.id} className={simple ? 'rounded-2xl border-l-8 border-cyan bg-surface-2 p-4' : 'py-3'}>
          <p className={`font-bold text-heading ${simple ? 'text-lg' : ''}`}>{h.title}</p>
          <p className={`text-muted ${simple ? 'text-base' : 'text-sm'}`}>{subjectName(db, h.subjectId)} · entregar el {formatDate(h.dueDate)}</p>
          {!simple && h.description && <p className="mt-1 text-sm">{h.description}</p>}
        </li>
      ))}
    </ul>
  )
}

export function StudentHome() {
  const { db, session, me, simple } = useMe()
  if (!me) return <EmptyState icon="alerta" title="No encontramos tu información" />
  const wd = new Date().getDay()
  const day = wd >= 1 && wd <= 5 ? wd : 1
  const classes = db.schedule.filter((s) => s.groupId === me.groupId && s.day === day).sort((a, b) => a.start.localeCompare(b.start))
  const news = visibleAnnouncements(db, session).slice(0, 3)
  const avg = averageFor(db, me.id, 'p1')
  const att = attendanceSummary(db, me.id)

  return (
    <>
      <PageHeader title={simple ? `¡Hola, ${me.firstName}!` : `Hola, ${me.firstName}`} subtitle={groupLabel(db, me.groupId)} />
      {!simple && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Stat label="Promedio 1er trimestre" value={avg?.toFixed(1) ?? '—'} icon="calificaciones" tone="info" />
          <Stat label="Asistencia" value={`${att.rate}%`} icon="asistencia" tone="exito" />
          <Stat label="Faltas" value={att.falta} icon="alerta" tone="aviso" />
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Tus clases del ${DAYS[day]?.toLowerCase()}`}>
          <ul className={simple ? 'space-y-2' : 'divide-y divide-line'}>
            {classes.map((c) => (
              <li key={c.id} className={simple ? 'flex items-center gap-3 rounded-xl bg-surface-2 p-3' : 'flex items-center justify-between gap-2 py-2'}>
                <span className={`font-semibold text-heading ${simple ? 'text-lg' : ''}`}>{subjectName(db, c.subjectId)}</span>
                <span className="ml-auto text-sm text-muted">{c.start}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Tareas por entregar" action={<Link to="/alumno/tareas" className="text-sm font-semibold text-link underline">Ver todas</Link>}>
          <HomeworkList limit={simple ? 3 : 5} />
        </Card>
        <Card title="Avisos" className="lg:col-span-2" action={<Link to="/avisos" className="text-sm font-semibold text-link underline">Ver todos</Link>}>
          <ul className="divide-y divide-line">
            {news.map((a) => (
              <li key={a.id} className="py-2">
                <p className="font-semibold text-heading">{a.title}</p>
                <p className="text-xs text-muted">{formatDate(a.createdAt)}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}

export function StudentSchedule() {
  const { db, me } = useMe()
  if (!me) return null
  return (
    <>
      <PageHeader title="Mi horario" subtitle={groupLabel(db, me.groupId)} />
      <ScheduleView db={db} slots={db.schedule.filter((s) => s.groupId === me.groupId)} show="grupo" />
    </>
  )
}

export function StudentHomework() {
  return (
    <>
      <PageHeader title="Mis tareas" subtitle="Tareas pendientes de entregar." />
      <Card>
        <HomeworkList />
      </Card>
    </>
  )
}

export function StudentGrades() {
  const { db, me } = useMe()
  if (!me) return null
  return (
    <>
      <PageHeader title="Mis calificaciones" subtitle="Ciclo 2026-2027" />
      <Card>
        <GradesTable db={db} studentId={me.id} />
      </Card>
    </>
  )
}
