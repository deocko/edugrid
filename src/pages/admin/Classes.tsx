import { useState, type FormEvent } from 'react'
import { Button, Card, EmptyState, Field, Modal, Notice, PageHeader, Select } from '../../components/ui'
import type { ScheduleSlot } from '../../data/types'
import { DAYS, uid } from '../../lib/format'
import { groupLabel, subjectName, teacherName } from '../../lib/scope'
import { useApp } from '../../state/context'
import { GroupAssignments } from './SchoolStructure'

const BLOCKS: [string, string][] = [['08:00', '08:50'], ['08:50', '09:40'], ['09:40', '10:30'], ['11:00', '11:50'], ['11:50', '12:40'], ['12:40', '13:30'], ['13:30', '14:20']]
const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) => a.start < b.end && b.start < a.end

/** Clases: qué materia da cada docente en cada grupo y en qué horario. */
export function Classes() {
  const { db, act } = useApp()
  const [groupId, setGroupId] = useState(db.groups[0]?.id ?? '')
  const [teachersOpen, setTeachersOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const group = db.groups.find((g) => g.id === groupId)
  const assignments = db.assignments.filter((a) => a.groupId === groupId)
  const slots = db.schedule.filter((s) => s.groupId === groupId)

  const remove = async (s: ScheduleSlot) => {
    await act((repo) => repo.remove('schedule', s.id), { action: 'Quitó clase del horario', detail: `${groupLabel(db, groupId)} · ${subjectName(db, s.subjectId)} · ${DAYS[s.day]} ${s.start}` })
  }

  return (
    <>
      <PageHeader title="Clases" subtitle="Materias, docentes y horario de cada grupo." actions={<Button icon="mas" onClick={() => setAdding(true)}>Agregar clase</Button>} />
      <Card className="mb-4">
        <div className="max-w-sm">
          <Field label="Grupo">{(id) => <Select id={id} value={groupId} onChange={(e) => setGroupId(e.target.value)}>{db.groups.map((g) => <option key={g.id} value={g.id}>{groupLabel(db, g)}</option>)}</Select>}</Field>
        </div>
        {group && <p className="mt-2 text-sm text-muted">Titular: {teacherName(db, group.homeroomTeacherId)} · Aula: {group.room}</p>}
      </Card>
      <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
        <Card title="Materias y docentes" action={<Button variant="secundario" icon="docente" onClick={() => setTeachersOpen(true)}>Cambiar docentes</Button>}>
          {assignments.length === 0 ? (
            <EmptyState icon="libro" title="Este grupo no tiene materias" />
          ) : (
            <ul className="divide-y divide-line">
              {assignments.map((a) => (
                <li key={a.id} className="flex justify-between gap-2 py-2.5">
                  <span className="font-semibold text-heading">{subjectName(db, a.subjectId)}</span>
                  <span className="text-right text-sm text-muted">{teacherName(db, a.teacherId)} · {slots.filter((s) => s.subjectId === a.subjectId).length} h/sem</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Horario semanal">
          {slots.length === 0 ? (
            <EmptyState icon="horario" title="Sin clases en el horario" />
          ) : (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((d) => {
                const day = slots.filter((s) => s.day === d).sort((a, b) => a.start.localeCompare(b.start))
                if (day.length === 0) return null
                return (
                  <section key={d}>
                    <h3 className="mb-1 text-sm font-bold text-heading">{DAYS[d]}</h3>
                    <ul className="divide-y divide-line">
                      {day.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 py-1.5">
                          <span className="min-w-0 text-sm"><strong className="tabular-nums">{s.start}–{s.end}</strong> · {subjectName(db, s.subjectId)} <span className="text-muted">· {teacherName(db, s.teacherId)}</span></span>
                          <Button variant="fantasma" icon="cerrar" onClick={() => void remove(s)} aria-label={`Quitar ${subjectName(db, s.subjectId)} del ${DAYS[s.day]} a las ${s.start}`} />
                        </li>
                      ))}
                    </ul>
                  </section>
                )
              })}
            </div>
          )}
        </Card>
      </div>
      <Modal open={teachersOpen} onClose={() => setTeachersOpen(false)} title={`Docentes de ${groupLabel(db, groupId)}`}>
        {teachersOpen && <GroupAssignments groupId={groupId} onDone={() => setTeachersOpen(false)} />}
      </Modal>
      <Modal open={adding} onClose={() => setAdding(false)} title={`Agregar clase a ${groupLabel(db, groupId)}`}>
        {adding && <AddClass groupId={groupId} onDone={() => setAdding(false)} />}
      </Modal>
    </>
  )
}

function AddClass({ groupId, onDone }: { groupId: string; onDone: () => void }) {
  const { db, act } = useApp()
  const assignments = db.assignments.filter((a) => a.groupId === groupId)
  const [assignmentId, setAssignmentId] = useState(assignments[0]?.id ?? '')
  const [day, setDay] = useState(1)
  const [block, setBlock] = useState(0)
  const [error, setError] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const a = assignments.find((x) => x.id === assignmentId)
    const b = BLOCKS[block]
    if (!a || !b) return setError('Elige la materia y la hora.')
    const slot = { start: b[0], end: b[1] }
    const busyGroup = db.schedule.find((s) => s.groupId === groupId && s.day === day && overlaps(s, slot))
    if (busyGroup) return setError(`El grupo ya tiene ${subjectName(db, busyGroup.subjectId)} el ${DAYS[day]?.toLowerCase()} a esa hora.`)
    const busyTeacher = db.schedule.find((s) => s.teacherId === a.teacherId && s.day === day && overlaps(s, slot))
    if (busyTeacher) return setError(`${teacherName(db, a.teacherId)} ya da clase en ${groupLabel(db, busyTeacher.groupId)} a esa hora.`)
    await act((repo) => repo.insert('schedule', [{ id: uid('h'), groupId, subjectId: a.subjectId, teacherId: a.teacherId, day, start: slot.start, end: slot.end }]), { action: 'Agregó clase al horario', detail: `${groupLabel(db, groupId)} · ${subjectName(db, a.subjectId)} · ${DAYS[day]} ${slot.start}` })
    onDone()
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3" noValidate>
      <Field label="Materia">{(id) => <Select id={id} value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)}>{assignments.map((a) => <option key={a.id} value={a.id}>{subjectName(db, a.subjectId)} · {teacherName(db, a.teacherId)}</option>)}</Select>}</Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Día">{(id) => <Select id={id} value={day} onChange={(e) => setDay(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{DAYS[d]}</option>)}</Select>}</Field>
        <Field label="Hora">{(id) => <Select id={id} value={block} onChange={(e) => setBlock(Number(e.target.value))}>{BLOCKS.map(([s, e], i) => <option key={s} value={i}>{s} – {e}</option>)}</Select>}</Field>
      </div>
      <p className="text-xs text-muted">El recreo es de 10:30 a 11:00 y no se puede usar para clases.</p>
      {error && <Notice tone="peligro">{error}</Notice>}
      <div className="flex justify-end"><Button type="submit" icon="check">Agregar al horario</Button></div>
    </form>
  )
}
