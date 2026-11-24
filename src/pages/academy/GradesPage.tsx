import { useMemo, useState } from 'react'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Notice, PageHeader, Select } from '../../components/ui'
import type { GradeRecord } from '../../data/types'
import { formatDateTime, nowISO, uid, plural } from '../../lib/format'
import { PRESCHOOL_SCALE, groupLabel, isPreschool, levelOfGroup, studentName, subjectName } from '../../lib/scope'
import { useApp } from '../../state/context'
import { useManagedGroups, useManagedSubjects } from './useTeacherGroups'
import { SubjectDot } from '../../components/Subject'

export function GradesPage() {
  const { db, session, act } = useApp()
  const groups = useManagedGroups()
  const [groupId, setGroupId] = useState(groups[0]?.id ?? '')
  const subjects = useManagedSubjects(groupId)
  const [subjectChoice, setSubjectChoice] = useState('')
  const subjectId = subjects.some((s) => s.subjectId === subjectChoice) ? subjectChoice : (subjects[0]?.subjectId ?? '')
  const periods = db.periods.filter((p) => p.cycleId === 'c2026')
  const [periodId, setPeriodId] = useState('p2')
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<{ tone: 'exito' | 'peligro'; text: string } | null>(null)
  const [confirm, setConfirm] = useState(false)

  const level = levelOfGroup(db, groupId)
  const preschool = isPreschool(level)
  const students = useMemo(() => db.students.filter((s) => s.groupId === groupId && s.status === 'activo').sort((a, b) => a.lastName.localeCompare(b.lastName)), [db, groupId])
  const records = db.gradeRecords.filter((r) => r.groupId === groupId && r.subjectId === subjectId && r.periodId === periodId)
  const closure = db.closures.find((c) => c.groupId === groupId && c.subjectId === subjectId && c.periodId === periodId)
  const current = (sid: string) => draft[sid] ?? (records.find((r) => r.studentId === sid)?.score.toString() ?? '')

  const reset = () => { setDraft({}); setMsg(null) }

  const validate = (): GradeRecord[] | null => {
    const rows: GradeRecord[] = []
    for (const s of students) {
      const raw = current(s.id).trim()
      if (!raw) continue
      const n = Number(raw)
      const ok = preschool ? [1, 2, 3, 4].includes(n) : !Number.isNaN(n) && n >= 5 && n <= 10
      if (!ok) {
        setMsg({ tone: 'peligro', text: `Revisa la calificación de ${studentName(s)}: debe estar entre 5 y 10.` })
        return null
      }
      const old = records.find((r) => r.studentId === s.id)
      rows.push({ id: old?.id ?? uid('cal'), studentId: s.id, groupId, subjectId, periodId, score: preschool ? n : Math.round(n * 10) / 10, updatedAt: nowISO() })
    }
    return rows
  }

  const save = async () => {
    const rows = validate()
    if (!rows) return
    await act((repo) => repo.upsert('gradeRecords', rows), { action: 'Capturó calificaciones', detail: `${groupLabel(db, groupId)} · ${subjectName(db, subjectId)} · ${plural(rows.length, 'alumno', 'alumnos')}` })
    setDraft({})
    setMsg({ tone: 'exito', text: 'Calificaciones guardadas. Las familias las verán como preliminares hasta que cierres el periodo.' })
  }

  const close = async () => {
    const rows = validate()
    if (!rows) return setConfirm(false)
    if (rows.length < students.length) {
      setConfirm(false)
      return setMsg({ tone: 'peligro', text: 'Para cerrar el periodo, todos los alumnos deben tener calificación.' })
    }
    await act(
      async (repo) => {
        await repo.upsert('gradeRecords', rows)
        await repo.insert('closures', [{ id: uid('ci'), groupId, subjectId, periodId, closedAt: nowISO(), closedBy: session.personId }])
      },
      { action: 'Cerró periodo', detail: `${groupLabel(db, groupId)} · ${subjectName(db, subjectId)} · ${periods.find((p) => p.id === periodId)?.name}` },
    )
    setDraft({})
    setConfirm(false)
    setMsg({ tone: 'exito', text: 'Periodo cerrado. Las calificaciones ya son definitivas.' })
  }

  const reopen = async () => {
    if (!closure) return
    await act((repo) => repo.remove('closures', closure.id), { action: 'Reabrió periodo', detail: `${groupLabel(db, groupId)} · ${subjectName(db, subjectId)}` })
    setMsg(null)
  }

  if (groups.length === 0) return <EmptyState icon="alumnos" title="No tienes grupos asignados" />

  return (
    <>
      <PageHeader title="Calificaciones" subtitle="Captura por grupo y materia. Al cerrar el periodo, las calificaciones quedan definitivas." />
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Grupo">
            {(id) => (
              <Select id={id} value={groupId} onChange={(e) => { setGroupId(e.target.value); setSubjectChoice(''); reset() }}>
                {groups.map((g) => <option key={g.id} value={g.id}>{groupLabel(db, g)}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Materia">
            {(id) => (
              <Select id={id} value={subjectId} onChange={(e) => { setSubjectChoice(e.target.value); reset() }}>
                {subjects.map((a) => <option key={a.id} value={a.subjectId}>{subjectName(db, a.subjectId)}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Periodo">
            {(id) => (
              <Select id={id} value={periodId} onChange={(e) => { setPeriodId(e.target.value); reset() }}>
                {periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            )}
          </Field>
        </div>
      </Card>

      {subjects.length === 0 ? (
        <EmptyState icon="calificaciones" title="No impartes materias en este grupo" />
      ) : students.length === 0 ? (
        <EmptyState icon="alumnos" title="Este grupo aún no tiene alumnos" />
      ) : (
        <Card
          title={<span className="inline-flex flex-wrap items-center gap-2"><SubjectDot db={db} id={subjectId} size={12} />{subjectName(db, subjectId)} · {groupLabel(db, groupId)}</span>}
          action={closure ? <Badge tone="exito">Cerrado el {formatDateTime(closure.closedAt)}</Badge> : <Badge tone="aviso">Periodo abierto</Badge>}
        >
          {records.length === 0 && !closure && (
            <div className="mb-3"><Notice tone="info" icon="calificaciones">Aún no hay calificaciones capturadas en este trimestre.</Notice></div>
          )}
          {preschool && <p className="mb-3 text-sm text-muted">En preescolar se registra el nivel de logro de cada niña o niño.</p>}
          <ul className="divide-y divide-line">
            {students.map((s) => (
              <li key={s.id} className="grid grid-cols-[1fr_auto] items-center gap-3 py-2.5">
                <label htmlFor={`cal-${s.id}`} className="font-semibold text-heading">{studentName(s)}</label>
                {preschool ? (
                  <Select id={`cal-${s.id}`} className="w-44" disabled={!!closure} value={current(s.id)} onChange={(e) => setDraft({ ...draft, [s.id]: e.target.value })}>
                    <option value="">Sin capturar</option>
                    {Object.entries(PRESCHOOL_SCALE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </Select>
                ) : (
                  <Input id={`cal-${s.id}`} className="w-24 text-center" type="number" inputMode="decimal" min={5} max={10} step={0.1} disabled={!!closure} value={current(s.id)} onChange={(e) => setDraft({ ...draft, [s.id]: e.target.value })} />
                )}
              </li>
            ))}
          </ul>
          {msg && <div className="mt-3"><Notice tone={msg.tone} icon={msg.tone === 'exito' ? 'check' : 'alerta'}>{msg.text}</Notice></div>}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {closure ? (
              session.role === 'admin' ? <Button variant="secundario" onClick={() => void reopen()}>Reabrir periodo</Button> : <p className="text-sm text-muted">Para corregir, pide a la dirección que reabra el periodo.</p>
            ) : (
              <>
                <Button variant="secundario" icon="check" onClick={() => void save()}>Guardar</Button>
                <Button icon="candado" onClick={() => setConfirm(true)}>Cerrar periodo</Button>
              </>
            )}
          </div>
        </Card>
      )}
      <Modal open={confirm} onClose={() => setConfirm(false)} title="¿Cerrar el periodo?">
        <p className="text-ink">Las calificaciones de {subjectName(db, subjectId)} en {groupLabel(db, groupId)} quedarán definitivas y las familias las verán así. Solo la dirección puede reabrirlo.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secundario" onClick={() => setConfirm(false)}>Cancelar</Button>
          <Button icon="candado" onClick={() => void close()}>Sí, cerrar periodo</Button>
        </div>
      </Modal>
    </>
  )
}
