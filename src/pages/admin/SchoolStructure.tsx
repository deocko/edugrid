import { useState, type FormEvent } from 'react'
import { Badge, Button, Card, Field, Input, Notice, PageHeader, Select, Tabs } from '../../components/ui'
import type { Level } from '../../data/types'
import { formatDate, uid } from '../../lib/format'
import { LEVEL_LABEL, LEVELS, groupLabel, levelOfGroup, teacherName } from '../../lib/scope'
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
                  <Badge tone="info">{db.students.filter((s) => s.groupId === g.id && s.status === 'activo').length} alumnos</Badge>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
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
                {db.teachers.map((t) => (
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
  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await act((repo) => repo.insert('subjects', [{ id: uid('s'), name: name.trim(), level }]), { action: 'Agregó materia', detail: `${name} (${LEVEL_LABEL[level]})` })
    setName('')
  }
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
        {LEVELS.map((l) => (
          <Card key={l} title={LEVEL_LABEL[l]}>
            <ul className="flex flex-wrap gap-2">
              {db.subjects.filter((s) => s.level === l).map((s) => (
                <li key={s.id}><Badge>{s.name}</Badge></li>
              ))}
            </ul>
          </Card>
        ))}
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
          <Button type="submit" icon="mas" className="w-full">Agregar materia</Button>
        </form>
      </Card>
    </div>
  )
}
