import { Link } from 'react-router'
import { Badge, Card, EmptyState, LinkButton, PageHeader, Stat } from '../../components/ui'
import { DAYS, demoDate, formatDate, todayISO } from '../../lib/format'
import { groupLabel, subjectName, teacherGroupIds, visibleAnnouncements } from '../../lib/scope'
import { useApp } from '../../state/context'

export function TeacherHome() {
  const { db, session } = useApp()
  const groupIds = teacherGroupIds(db, session.personId)
  const groups = db.groups.filter((g) => groupIds.has(g.id))
  const wd = demoDate().getDay()
  const day = wd >= 1 && wd <= 5 ? wd : 1
  const classes = db.schedule.filter((s) => s.teacherId === session.personId && s.day === day).sort((a, b) => a.start.localeCompare(b.start))
  const today = todayISO()
  const homework = db.homework.filter((h) => h.teacherId === session.personId && h.dueDate >= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const takenToday = groups.filter((g) => db.attendance.some((a) => a.groupId === g.id && a.date === today)).length
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
        <Card title={`Clases del ${DAYS[day]?.toLowerCase()}`} className="lg:col-span-2">
          {classes.length === 0 ? (
            <EmptyState icon="horario" title="No tienes clases este día" />
          ) : (
            <ul className="divide-y divide-line">
              {classes.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div>
                    <p className="font-semibold text-heading">{subjectName(db, c.subjectId)}</p>
                    <p className="text-sm text-muted">{c.start} – {c.end} · {groupLabel(db, c.groupId)}</p>
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
                  <p className="font-semibold text-heading">{h.title}</p>
                  <p className="text-sm text-muted">{groupLabel(db, h.groupId)} · {subjectName(db, h.subjectId)} · entrega {formatDate(h.dueDate)}</p>
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
