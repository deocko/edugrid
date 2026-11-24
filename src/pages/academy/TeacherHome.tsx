import { Link } from 'react-router'
import { Badge, Card, EmptyState, LinkButton, PageHeader, Stat } from '../../components/ui'
import { DAYS, demoDate, formatDate, todayISO } from '../../lib/format'
import { groupLabel, subjectName, teacherGroupIds, teacherName, visibleAnnouncements } from '../../lib/scope'
import { useApp } from '../../state/context'
import { SubjectTag } from '../../components/Subject'
import { subjectStripe } from '../../lib/subjects'

export function TeacherHome() {
  const { db, session } = useApp()
  const groupIds = teacherGroupIds(db, session.personId)
  const groups = db.groups.filter((g) => groupIds.has(g.id))
  const wd = demoDate().getDay()
  const day = wd >= 1 && wd <= 5 ? wd : 1
  // Las clases del día de sus grupos como titular (todas, las imparta ella o no) y las que imparte en otros grupos.
  const homeroom = new Set(db.groups.filter((g) => g.homeroomTeacherId === session.personId).map((g) => g.id))
  const classes = db.schedule.filter((s) => s.day === day && (s.teacherId === session.personId || homeroom.has(s.groupId))).sort((a, b) => a.start.localeCompare(b.start) || a.groupId.localeCompare(b.groupId))
  const mine = classes.filter((c) => c.teacherId === session.personId).length
  const today = todayISO()
  const homework = db.homework.filter((h) => h.teacherId === session.personId && h.dueDate >= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  // Un grupo tiene lista cuando todos sus alumnos activos tienen asistencia de hoy (por QR o por la docente).
  const takenToday = groups.filter((g) => { const ids = db.students.filter((s) => s.groupId === g.id && s.status === 'activo').map((s) => s.id); return ids.length > 0 && ids.every((id) => db.attendance.some((a) => a.studentId === id && a.date === today)) }).length
  const openGrades = db.assignments.filter((a) => a.teacherId === session.personId && !db.closures.some((c) => c.groupId === a.groupId && c.subjectId === a.subjectId && c.periodId === 'p2')).length
  const news = visibleAnnouncements(db, session).slice(0, 3)

  return (
    <>
      <PageHeader title={`Hola, ${session.name.split(' ')[0]}`} subtitle="Esto es lo que tienes para hoy." actions={<><LinkButton to="/docente/entradas" icon="qr">Escanear QR</LinkButton><LinkButton to="/docente/novedades" variant="secundario" icon="camara">Enviar novedad</LinkButton></>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Mis grupos" value={groups.length} icon="alumnos" tone="info" />
        <Stat label="Alumnos" value={db.students.filter((s) => groupIds.has(s.groupId) && s.status === 'activo').length} icon="hijo" tone="info" />
        <Stat label="Listas de hoy" value={`${takenToday}/${groups.length}`} hint="Grupos con asistencia" icon="asistencia" tone="exito" />
        <Stat label="Calificaciones abiertas" value={openGrades} hint="2º trimestre" icon="calificaciones" tone="aviso" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title={`Clases del ${DAYS[day]?.toLowerCase()}`} action={classes.length > 0 && <span className="text-sm text-muted">{mine} de {classes.length} las impartes tú</span>} className="lg:col-span-2">
          {classes.length === 0 ? (
            <EmptyState icon="horario" title="No tienes clases este día" />
          ) : (
            <ul className="divide-y divide-line">
              {classes.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className={subjectStripe(db, c.subjectId)}>
                    <p className="font-semibold text-heading">{subjectName(db, c.subjectId)}</p>
                    <p className="text-sm text-muted">{c.start} – {c.end} · {groupLabel(db, c.groupId)}{c.teacherId === session.personId ? ' · La impartes tú' : ` · La imparte ${teacherName(db, c.teacherId)}`}</p>
                  </div>
                  <LinkButton to={`/docente/asistencia?grupo=${c.groupId}`} variant="secundario" icon="asistencia">Pasar lista</LinkButton>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Mis grupos">
          <ul className="space-y-2">
            {groups.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                <span className="font-semibold text-heading">{groupLabel(db, g)}</span>
                {g.homeroomTeacherId === session.personId && <Badge tone="info">Titular</Badge>}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Tareas por entregar" className="lg:col-span-2">
          {homework.length === 0 ? (
            <EmptyState icon="tareas" title="No hay tareas pendientes" action={<LinkButton to="/docente/tareas" variant="secundario">Dejar una tarea</LinkButton>} />
          ) : (
            <ul className="divide-y divide-line">
              {homework.slice(0, 5).map((h) => (
                <li key={h.id} className="py-2.5">
                  <div className={subjectStripe(db, h.subjectId)}>
                    <p className="font-semibold text-heading">{h.title}</p>
                    <p className="text-sm text-muted">{groupLabel(db, h.groupId)} · <SubjectTag db={db} id={h.subjectId} /> · entrega {formatDate(h.dueDate)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Avisos recientes" action={<Link to="/avisos" className="-mr-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-link no-underline hover:bg-info-bg">Ver todos</Link>}>
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
