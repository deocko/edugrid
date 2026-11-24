import { useState, type FormEvent } from 'react'
import { Badge, Button, Card, Field, Input, Modal, Notice, PageHeader, Select, Switch, Tabs } from '../../components/ui'
import { ColorPicker, SubjectDot } from '../../components/Subject'
import { subjectCard } from '../../lib/subjects'
import type { Level, Subject, SubjectColor } from '../../data/types'
import { formatDate, uid, plural } from '../../lib/format'
import { LEVEL_LABEL, LEVELS, groupLabel, levelOfGroup, subjectName, teacherName } from '../../lib/scope'
import { SUBJECT_COLORS, suggestColor } from '../../lib/subjects'
import { useApp } from '../../state/context'

type View = 'grupos' | 'ciclos' | 'materias'

export function SchoolStructure() {
  const [view, setView] = useState<View>('grupos')
  return (
    <>
      <PageHeader title="Ciclos y grupos" subtitle="Organiza ciclos escolares, grados, grupos y materias." />
      <Tabs label="Secciones" value={view} onChange={setView} options={[{ value: 'grupos', label: 'Grados y grupos' }, { value: 'ciclos', label: 'Ciclos y trimestres' }, { value: 'materias', label: 'Materias' }]} />
      {view === 'grupos' && <GroupsView />}
      {view === 'ciclos' && <CyclesView />}
      {view === 'materias' && <SubjectsView />}
    </>
  )
}

function GroupsView() {
  const { db, act } = useApp()
  const [gradeId, setGradeId] = useState('')
  const [name, setName] = useState('B')
  const [teacherId, setTeacherId] = useState('')
  const [msg, setMsg] = useState('')
  const [editGroup, setEditGroup] = useState<string | null>(null)
  const active = db.cycles.find((c) => c.active)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!gradeId || !teacherId || !name.trim() || !active) return setMsg('Elige grado, nombre del grupo y titular.')
    if (db.groups.some((g) => g.gradeId === gradeId && g.name === name.trim().toUpperCase())) return setMsg('Ese grupo ya existe.')
    const id = uid('gr')
    const level = db.grades.find((g) => g.id === gradeId)?.level
    const subjects = db.subjects.filter((s) => s.level === level)
    await act(
      async (repo) => {
        await repo.insert('groups', [{ id, gradeId, cycleId: active.id, name: name.trim().toUpperCase(), homeroomTeacherId: teacherId, room: `Salón ${100 + db.groups.length + 1}` }])
        await repo.insert('assignments', subjects.map((s) => ({ id: uid('a'), groupId: id, subjectId: s.id, teacherId })))
      },
      { action: 'Creó grupo', detail: `${db.grades.find((g) => g.id === gradeId)?.name} ${name.toUpperCase()}` },
    )
    setMsg('Grupo creado. Las materias del nivel se asignaron al titular; puedes cambiarlas después.')
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {LEVELS.map((l) => (
          <Card key={l} title={LEVEL_LABEL[l]}>
            <ul className="divide-y divide-line">
              {db.groups.filter((g) => levelOfGroup(db, g.id) === l).map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="font-semibold text-heading">{groupLabel(db, g)}</p>
                    <p className="text-muted">Titular: {teacherName(db, g.homeroomTeacherId)} · {g.room}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="info">{plural(db.students.filter((s) => s.groupId === g.id && s.status === 'activo').length, 'alumno', 'alumnos')}</Badge>
                    <Button variant="fantasma" onClick={() => setEditGroup(g.id)} aria-label={`Materias y docentes de ${groupLabel(db, g)}`}>Materias y docentes</Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
      <Modal open={editGroup !== null} onClose={() => setEditGroup(null)} title={editGroup ? `Materias y docentes · ${groupLabel(db, editGroup)}` : 'Materias y docentes'}>
        {editGroup && <GroupAssignments groupId={editGroup} onDone={() => setEditGroup(null)} />}
      </Modal>
      <Card title="Nuevo grupo" className="h-fit">
        <form onSubmit={(e) => void submit(e)} className="space-y-3">
          <Field label="Grado">
            {(id) => (
              <Select id={id} value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
                <option value="">Elige un grado</option>
                {db.grades.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Nombre del grupo">{(id) => <Input id={id} value={name} maxLength={2} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Titular">
            {(id) => (
              <Select id={id} value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                <option value="">Elige un docente</option>
                {db.teachers.filter((t) => t.active).map((t) => (
                  <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                ))}
              </Select>
            )}
          </Field>
          {msg && <Notice>{msg}</Notice>}
          <Button type="submit" icon="mas" className="w-full">Crear grupo</Button>
        </form>
      </Card>
    </div>
  )
}

function CyclesView() {
  const { db, act } = useApp()
  const [name, setName] = useState('Ciclo 2027-2028')
  const [start, setStart] = useState('2027-08-23')
  const [end, setEnd] = useState('2028-07-07')
  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !start || !end) return
    await act((repo) => repo.insert('cycles', [{ id: uid('c'), name: name.trim(), startDate: start, endDate: end, active: false }]), { action: 'Creó ciclo escolar', detail: name })
  }
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Ciclos escolares" className="lg:col-span-2">
        <ul className="divide-y divide-line">
          {db.cycles.map((c) => (
            <li key={c.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-heading">{c.name}</p>
                {c.active ? <Badge tone="exito">Ciclo actual</Badge> : <Badge>{c.startDate > '2027' ? 'Próximo' : 'Concluido'}</Badge>}
              </div>
              <p className="text-sm text-muted">{formatDate(c.startDate)} al {formatDate(c.endDate)}</p>
              {c.active && (
                <ul className="mt-2 grid gap-2 sm:grid-cols-3">
                  {db.periods.filter((p) => p.cycleId === c.id).map((p) => (
                    <li key={p.id} className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
                      <p className="font-semibold text-heading">{p.name}</p>
                      <p className="text-xs text-muted">{formatDate(p.startDate)} – {formatDate(p.endDate)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Nuevo ciclo" className="h-fit">
        <form onSubmit={(e) => void add(e)} className="space-y-3">
          <Field label="Nombre">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Inicio">{(id) => <Input id={id} type="date" value={start} onChange={(e) => setStart(e.target.value)} />}</Field>
          <Field label="Fin">{(id) => <Input id={id} type="date" value={end} onChange={(e) => setEnd(e.target.value)} />}</Field>
          <Button type="submit" icon="mas" className="w-full">Crear ciclo</Button>
        </form>
      </Card>
    </div>
  )
}

function SubjectsView() {
  const { db, act } = useApp()
  const [level, setLevel] = useState<Level>('primaria')
  const [name, setName] = useState('')
  const [color, setColor] = useState<SubjectColor | null>(null)
  const [editing, setEditing] = useState<Subject | null>(null)
  const chosen = color ?? suggestColor(db, name, level)
  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await act((repo) => repo.insert('subjects', [{ id: uid('s'), name: name.trim(), level, color: chosen }]), { action: 'Agregó materia', detail: `${name} (${LEVEL_LABEL[level]})` })
    setName('')
    setColor(null)
  }
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
        {LEVELS.map((l) => (
          <Card key={l} title={LEVEL_LABEL[l]}>
            <ul className="flex flex-wrap gap-2">
              {db.subjects.filter((s) => s.level === l).map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(s)}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[var(--s-ink)] ${subjectCard(db, s.id)} hover:brightness-95`}
                    aria-label={`${s.name}: cambiar color`}
                  >
                    <SubjectDot db={db} id={s.id} />
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ))}
        <p className="text-sm text-muted sm:col-span-2">Toca una materia para cambiar su color. Ese color se usa en horarios, tareas, calificaciones, calendario y boleta.</p>
      </div>
      <Card title="Nueva materia" className="h-fit">
        <form onSubmit={(e) => void add(e)} className="space-y-3">
          <Field label="Nivel">
            {(id) => (
              <Select id={id} value={level} onChange={(e) => setLevel(e.target.value as Level)}>
                {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Nombre de la materia">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <ColorPicker legend="Color" value={chosen} onChange={setColor} />
          <Button type="submit" icon="mas" className="w-full">Agregar materia</Button>
        </form>
      </Card>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Color de ${editing.name}` : ''}>
        {editing && <SubjectColorForm subject={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  )
}

function SubjectColorForm({ subject, onDone }: { subject: Subject; onDone: () => void }) {
  const { db, act } = useApp()
  const [color, setColor] = useState<SubjectColor>(subject.color)
  const twins = db.subjects.filter((s) => s.id !== subject.id && s.name.trim().toLowerCase() === subject.name.trim().toLowerCase())
  const [all, setAll] = useState(true)
  const save = async () => {
    const ids = [subject.id, ...(all ? twins.map((t) => t.id) : [])]
    await act(
      async (repo) => {
        for (const id of ids) await repo.update('subjects', id, { color })
      },
      { action: 'Cambió color de materia', detail: `${subject.name}: ${SUBJECT_COLORS.find((c) => c.value === color)?.label ?? color}` },
    )
    onDone()
  }
  return (
    <div className="space-y-4">
      <ColorPicker legend="Elige un color" value={color} onChange={setColor} />
      {twins.length > 0 && <Switch checked={all} onChange={setAll} label={`Usar el mismo color en ${plural(twins.length, 'otro nivel', 'otros niveles')}`} description={twins.map((t) => LEVEL_LABEL[t.level]).join(', ')} />}
      <div className="flex justify-end gap-2">
        <Button variant="secundario" onClick={onDone}>Cancelar</Button>
        <Button icon="check" onClick={() => void save()}>Guardar color</Button>
      </div>
    </div>
  )
}

export function GroupAssignments({ groupId, onDone }: { groupId: string; onDone: () => void }) {
  const { db, act } = useApp()
  const group = db.groups.find((g) => g.id === groupId)
  const level = levelOfGroup(db, groupId)
  const current = db.assignments.filter((a) => a.groupId === groupId)
  const subjects = db.subjects.filter((s) => s.level === level)
  const teachers = db.teachers.filter((t) => t.active)
  const [homeroom, setHomeroom] = useState(group?.homeroomTeacherId ?? '')
  const [map, setMap] = useState<Record<string, string>>(Object.fromEntries(subjects.map((s) => [s.id, current.find((a) => a.subjectId === s.id)?.teacherId ?? ''])))
  if (!group) return null

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const changes: string[] = []
    if (homeroom && homeroom !== group.homeroomTeacherId) changes.push(`titular: ${teacherName(db, homeroom)}`)
    for (const s of subjects) {
      const before = current.find((a) => a.subjectId === s.id)?.teacherId ?? ''
      const after = map[s.id] ?? ''
      if (before !== after) changes.push(`${s.name}: ${after ? teacherName(db, after) : 'sin docente'}`)
    }
    await act(
      async (repo) => {
        if (homeroom && homeroom !== group.homeroomTeacherId) {
          await repo.update('groups', groupId, { homeroomTeacherId: homeroom })
        }
        for (const s of subjects) {
          const existing = current.find((a) => a.subjectId === s.id)
          const teacherId = map[s.id] ?? ''
          if (existing && !teacherId) {
            await repo.remove('assignments', existing.id)
          } else if (existing && existing.teacherId !== teacherId) {
            await repo.update('assignments', existing.id, { teacherId })
          } else if (!existing && teacherId) {
            await repo.insert('assignments', [{ id: uid('a'), groupId, subjectId: s.id, teacherId }])
          }
        }
        // El horario sigue al docente asignado a cada materia
        for (const slot of db.schedule.filter((x) => x.groupId === groupId)) {
          const teacherId = map[slot.subjectId]
          if (teacherId && teacherId !== slot.teacherId) await repo.update('schedule', slot.id, { teacherId })
        }
      },
      { action: 'Cambió materias y docentes', detail: `${groupLabel(db, groupId)}${changes.length ? ` · ${changes.join(', ')}` : ' · sin cambios'}` },
    )
    onDone()
  }

  return (
    <form onSubmit={(e) => void save(e)} className="space-y-3">
      <Field label="Titular del grupo">
        {(id) => (
          <Select id={id} value={homeroom} onChange={(e) => setHomeroom(e.target.value)}>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
          </Select>
        )}
      </Field>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-bold text-heading">Docente por materia</legend>
        {subjects.map((s) => (
          <Field key={s.id} label={subjectName(db, s.id)}>
            {(id) => (
              <Select id={id} value={map[s.id] ?? ''} onChange={(e) => setMap({ ...map, [s.id]: e.target.value })}>
                <option value="">Sin docente (no se imparte)</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName} · {t.specialty}</option>)}
              </Select>
            )}
          </Field>
        ))}
      </fieldset>
      <p className="text-xs text-muted">Cada docente solo ve a los grupos donde es titular o imparte alguna materia.</p>
      <div className="flex justify-end gap-2">
        <Button variant="secundario" onClick={onDone}>Cancelar</Button>
        <Button type="submit" icon="check">Guardar</Button>
      </div>
    </form>
  )
}
