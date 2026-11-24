// Bloques reutilizables para mostrar asistencia y calificaciones de UN alumno.
// Quien los use debe haber validado antes que la sesión puede ver a ese alumno.
import type { Database } from '../data/types'
import { ATT_LABEL, ATT_TONE, attendanceSummary } from '../lib/attendance'
import { formatDate } from '../lib/format'
import { formatScore, isPreschool, levelOfGroup, subjectName } from '../lib/scope'
import { Badge, EmptyState, Table, TD, TH } from './ui'

export function AttendanceList({ db, studentId, limit = 10 }: { db: Database; studentId: string; limit?: number }) {
  const sum = attendanceSummary(db, studentId)
  if (sum.list.length === 0) return <EmptyState icon="asistencia" title="Aún no hay registros de asistencia" />
  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <p className="rounded-xl bg-success-bg px-3 py-2 text-success"><strong className="block text-lg">{sum.rate}%</strong>Asistencia</p>
        <p className="rounded-xl bg-warning-bg px-3 py-2 text-warning"><strong className="block text-lg">{sum.retardo}</strong>Retardos</p>
        <p className="rounded-xl bg-danger-bg px-3 py-2 text-danger"><strong className="block text-lg">{sum.falta}</strong>Faltas</p>
        <p className="rounded-xl bg-info-bg px-3 py-2 text-info"><strong className="block text-lg">{sum.justificada}</strong>Justificadas</p>
      </div>
      <ul className="divide-y divide-line">
        {sum.list.slice(0, limit).map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <span>{formatDate(a.date)}</span>
            <Badge tone={ATT_TONE[a.status]}>{ATT_LABEL[a.status]}</Badge>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function GradesTable({ db, studentId }: { db: Database; studentId: string }) {
  const student = db.students.find((s) => s.id === studentId)
  if (!student) return null
  const level = levelOfGroup(db, student.groupId)
  const subjects = db.assignments.filter((a) => a.groupId === student.groupId).map((a) => a.subjectId)
  const periods = db.periods.filter((p) => p.cycleId === 'c2026')
  const records = db.gradeRecords.filter((r) => r.studentId === studentId)
  const isClosed = (subjectId: string, periodId: string) => db.closures.some((c) => c.groupId === student.groupId && c.subjectId === subjectId && c.periodId === periodId)
  if (subjects.length === 0) return <EmptyState icon="calificaciones" title="Sin materias asignadas" />
  return (
    <>
      {isPreschool(level) && <p className="mb-2 text-sm text-muted">En preescolar se evalúa con niveles de logro: Requiere apoyo, En proceso, Logrado y Destacado.</p>}
      <Table caption="Calificaciones por materia y trimestre">
        <thead>
          <tr>
            <th className={TH}>Materia</th>
            {periods.map((p) => (
              <th key={p.id} className={`${TH} text-center`}>{p.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {subjects.map((sid) => (
            <tr key={sid}>
              <td className={`${TD} font-semibold text-heading`}>{subjectName(db, sid)}</td>
              {periods.map((p) => {
                const r = records.find((x) => x.subjectId === sid && x.periodId === p.id)
                const closed = isClosed(sid, p.id)
                const low = r && !isPreschool(level) && r.score < 7
                return (
                  <td key={p.id} className={`${TD} text-center whitespace-nowrap`}>
                    <span className={low ? 'font-bold text-danger' : 'text-heading'}>{formatScore(level, r?.score)}</span>
                    {r && !closed && <span className="block text-[11px] text-muted">Preliminar</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  )
}
