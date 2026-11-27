import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ATT_LABEL } from '../../lib/attendance'
import { checkinsOfDay } from '../../lib/presence'
import { Avatar, Button, Card, EmptyState, Field, Input, Notice, PageHeader, Select } from '../../components/ui'
import type { AttendanceRecord, AttendanceStatus } from '../../data/types'
import { formatDateLong, todayISO, plural } from '../../lib/format'
import { groupLabel, studentName } from '../../lib/scope'
import { useApp } from '../../state/context'
import { useManagedGroups } from './useTeacherGroups'

const STATUSES: AttendanceStatus[] = ['presente', 'retardo', 'falta', 'justificada']
const ACTIVE: Record<AttendanceStatus, string> = {
  presente: 'bg-success-bg text-success border-success',
  retardo: 'bg-warning-bg text-warning border-warning',
  falta: 'bg-danger-bg text-danger border-danger',
  justificada: 'bg-info-bg text-info border-info',
}

export function AttendancePage() {
  const { db, session, act } = useApp()
  const groups = useManagedGroups()
  const [params, setParams] = useSearchParams()
  const groupId = params.get('grupo') ?? groups[0]?.id ?? ''
  const [date, setDate] = useState(todayISO())
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({})
  const [saved, setSaved] = useState('')

  const students = useMemo(() => db.students.filter((s) => s.groupId === groupId && s.status === 'activo').sort((a, b) => a.lastName.localeCompare(b.lastName)), [db, groupId])
  const existing = useMemo(() => Object.fromEntries(db.attendance.filter((a) => a.groupId === groupId && a.date === date).map((a) => [a.studentId, a.status])), [db, groupId, date])
  const value = (id: string): AttendanceStatus | undefined => draft[id] ?? existing[id]
  const fromQr = useMemo(() => new Set(db.attendance.filter((a) => a.groupId === groupId && a.date === date && a.source === 'qr').map((a) => a.studentId)), [db, groupId, date])
  const recorded = students.filter((s) => existing[s.id]).length
  const allowed = groups.some((g) => g.id === groupId)
  const weekend = [0, 6].includes(new Date(`${date}T12:00:00`).getDay())

  const save = async () => {
    const rows: AttendanceRecord[] = students.map((s) => ({ id: `as-${groupId}-${s.id}-${date}`, groupId, studentId: s.id, date, status: value(s.id) ?? 'presente', recordedBy: session.personId, source: 'docente' }))
    // conserva el id de registros existentes para reemplazarlos
    for (const r of rows) {
      const old = db.attendance.find((a) => a.studentId === r.studentId && a.date === date)
      if (old) r.id = old.id
    }
    await act((repo) => repo.upsert('attendance', rows), { action: 'Guardó asistencia', detail: `${groupLabel(db, groupId)} · ${date} · ${plural(rows.filter((r) => r.status === 'falta').length, 'falta', 'faltas')}` })
    setDraft({})
    setSaved(`Asistencia guardada para ${plural(students.length, 'alumno', 'alumnos')}.`)
  }

  if (groups.length === 0)
    return session.role === 'admin' ? (
      <EmptyState icon="alumnos" title="La escuela aún no tiene grupos">Crea los grupos en Ciclos y grupos para pasar lista.</EmptyState>
    ) : (
      <EmptyState icon="alumnos" title="No tienes grupos asignados">Cuando la dirección te asigne un grupo, aparecerá aquí.</EmptyState>
    )

  return (
    <>
      <PageHeader title="Pase de lista" subtitle={formatDateLong(date)} />
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Grupo">
            {(id) => (
              <Select id={id} value={groupId} onChange={(e) => { setParams({ grupo: e.target.value }); setDraft({}); setSaved('') }}>
                {groups.map((g) => <option key={g.id} value={g.id}>{groupLabel(db, g)}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Fecha">{(id) => <Input id={id} type="date" value={date} max={todayISO()} onChange={(e) => { setDate(e.target.value); setDraft({}); setSaved('') }} />}</Field>
        </div>
      </Card>
      {!allowed ? (
        <Notice tone="peligro">Este grupo no está asignado a tu cuenta.</Notice>
      ) : students.length === 0 ? (
        <EmptyState icon="alumnos" title="Este grupo aún no tiene alumnos">{session.role === 'admin' ? 'Inscribe alumnos o impórtalos desde Excel en Alumnos.' : 'Cuando la dirección inscriba alumnos en este grupo, aparecerán aquí.'}</EmptyState>
      ) : (
        <Card
          title={plural(students.length, 'alumno', 'alumnos')}
          action={
            <Button variant="secundario" icon="check" onClick={() => setDraft(Object.fromEntries(students.map((s) => [s.id, 'presente'])))}>
              Todos presentes
            </Button>
          }
        >
          {weekend && <div className="mb-3"><Notice tone="aviso">La fecha elegida es fin de semana.</Notice></div>}
          <p className="mb-3 text-sm text-muted" role="status">
            {recorded === 0
              ? 'Aún no se ha pasado lista en esta fecha.'
              : `${recorded} de ${plural(students.length, 'alumno', 'alumnos')} con asistencia registrada${fromQr.size ? `, ${fromQr.size} por su entrada con QR` : ''}. Puedes corregirla y guardar.`}
          </p>
          <ul className="divide-y divide-line">
            {students.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={studentName(s)} src={s.photo} size={36} />
                  <div className="min-w-0">
                    <p className="font-semibold text-heading">{studentName(s)}</p>
                    {(() => {
                      const entry = checkinsOfDay(db, s.id, date).find((c) => c.type === 'entrada')
                      return entry ? <p className="text-xs text-muted">Entró {entry.at.slice(11, 16)} con QR{fromQr.has(s.id) && !draft[s.id] ? ' · marcado automáticamente' : ''}</p> : null
                    })()}
                  </div>
                </div>
                <div role="radiogroup" aria-label={`Asistencia de ${studentName(s)}`} className="grid grid-cols-4 gap-1.5 md:flex">
                  {STATUSES.map((st) => {
                    const on = value(s.id) === st
                    return (
                      <button
                        key={st}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => { setDraft({ ...draft, [s.id]: st }); setSaved('') }}
                        className={`min-h-11 rounded-xl border px-2 text-xs font-semibold sm:text-sm ${on ? ACTIVE[st] : 'border-line bg-surface text-muted hover:bg-surface-2'}`}
                      >
                        {st === 'justificada' ? 'Justificada' : ATT_LABEL[st]}
                      </button>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            {saved && <span className="text-sm font-semibold text-success" role="status">{saved}</span>}
            <Button icon="check" onClick={() => void save()}>Guardar asistencia</Button>
          </div>
        </Card>
      )}
    </>
  )
}
