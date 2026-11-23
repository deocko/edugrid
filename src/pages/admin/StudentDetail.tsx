import { useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router'
import { AccessDenied } from '../../components/guards'
import { AttendanceList, GradesTable } from '../../components/StudentRecords'
import { Badge, Card, DemoBadge, LinkButton, PageHeader } from '../../components/ui'
import { ageFrom, formatDate, formatMoney } from '../../lib/format'
import { studentBalance } from '../../lib/finance'
import { canSeeStudent, groupLabel, studentName, teacherName } from '../../lib/scope'
import { useApp } from '../../state/context'

export function StudentDetail() {
  const { id = '' } = useParams()
  const { db, session, log } = useApp()
  const student = db.students.find((s) => s.id === id)
  const allowed = canSeeStudent(db, session, id)
  const logged = useRef('')
  useEffect(() => {
    if (!allowed || !student || logged.current === id) return
    logged.current = id
    void log({ action: 'Consultó expediente', detail: studentName(student), kind: 'acceso' })
  }, [allowed, student, id, log])

  if (!student || !allowed) return <AccessDenied detail={`Expediente de alumno ${id}`} />
  const group = db.groups.find((g) => g.id === student.groupId)
  const guardians = db.guardians.filter((g) => student.guardianIds.includes(g.id))
  const bal = studentBalance(db, student.id)
  const isAdmin = session.role === 'admin'

  return (
    <>
      <PageHeader
        title={studentName(student)}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            {groupLabel(db, student.groupId)} · {ageFrom(student.birthDate)} años · Matrícula {student.enrollmentId} <DemoBadge />
          </span>
        }
        actions={isAdmin ? <LinkButton to={`/pagos/estado/${student.id}`} icon="pagos">Estado de cuenta</LinkButton> : undefined}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Datos generales">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted">Nacimiento</dt>
            <dd className="text-heading">{formatDate(student.birthDate)}</dd>
            {isAdmin && (
              <>
                <dt className="text-muted">CURP</dt>
                <dd className="break-all text-heading">{student.curp}</dd>
              </>
            )}
            <dt className="text-muted">Titular</dt>
            <dd className="text-heading">{group ? teacherName(db, group.homeroomTeacherId) : '—'}</dd>
            <dt className="text-muted">Salón</dt>
            <dd className="text-heading">{group?.room}</dd>
          </dl>
        </Card>
        <Card title="Familia" className="lg:col-span-2">
          <ul className="space-y-3">
            {guardians.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <p className="font-semibold text-heading">
                    {g.firstName} {g.lastName} <span className="font-normal text-muted">· {g.relation}</span>
                  </p>
                  <p className="text-muted">{g.phone}{isAdmin && g.email ? ` · ${g.email}` : ''}</p>
                </div>
                {g.consentAt ? <Badge tone="exito">Consentimiento firmado</Badge> : <Badge tone="aviso">Consentimiento pendiente</Badge>}
              </li>
            ))}
          </ul>
          {isAdmin && (
            <p className="mt-3 text-sm">
              Saldo pendiente: <strong className={bal.overdue > 0 ? 'text-danger' : 'text-heading'}>{formatMoney(bal.balance)}</strong>
              {bal.overdue > 0 && <span className="text-danger"> ({formatMoney(bal.overdue)} vencido)</span>}
            </p>
          )}
        </Card>
        <Card title="Asistencia reciente">
          <AttendanceList db={db} studentId={student.id} limit={6} />
        </Card>
        <Card title="Calificaciones" className="lg:col-span-2">
          <GradesTable db={db} studentId={student.id} />
        </Card>
      </div>
      <p className="mt-4 text-sm">
        <Link to={isAdmin ? '/admin/alumnos' : '/docente'} className="font-semibold text-link underline">
          Volver
        </Link>
      </p>
    </>
  )
}
