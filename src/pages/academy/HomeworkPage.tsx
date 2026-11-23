import { useState, type FormEvent } from 'react'
import { Button, Card, EmptyState, Field, Input, Notice, PageHeader, Select, Textarea } from '../../components/ui'
import { formatDate, todayISO, uid } from '../../lib/format'
import { groupLabel, subjectName } from '../../lib/scope'
import { useApp } from '../../state/context'
import { useManagedGroups } from './useTeacherGroups'

export function HomeworkPage() {
  const { db, session, act } = useApp()
  const groups = useManagedGroups()
  const mine = db.assignments.filter((a) => a.teacherId === session.personId)
  const [form, setForm] = useState({ assignmentId: mine[0]?.id ?? '', title: '', description: '', dueDate: '' })
  const [error, setError] = useState('')
  const list = db.homework.filter((h) => h.teacherId === session.personId).sort((a, b) => b.dueDate.localeCompare(a.dueDate))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const a = mine.find((x) => x.id === form.assignmentId)
    if (!a || !form.title.trim() || !form.dueDate) return setError('Elige grupo y materia, escribe un título y la fecha de entrega.')
    await act(
      (repo) => repo.insert('homework', [{ id: uid('ta'), groupId: a.groupId, subjectId: a.subjectId, title: form.title.trim(), description: form.description.trim(), assignedDate: todayISO(), dueDate: form.dueDate, teacherId: session.personId }]),
      { action: 'Dejó tarea', detail: `${form.title} · ${groupLabel(db, a.groupId)}` },
    )
    setForm({ ...form, title: '', description: '', dueDate: '' })
    setError('')
  }

  if (groups.length === 0) return <EmptyState icon="alumnos" title="No tienes grupos asignados" />
  return (
    <>
      <PageHeader title="Tareas" subtitle="Lo que dejes aquí lo ven tus alumnos y sus familias." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Nueva tarea" className="h-fit lg:order-2">
          <form onSubmit={(e) => void submit(e)} className="space-y-3" noValidate>
            <Field label="Grupo y materia">
              {(id) => (
                <Select id={id} value={form.assignmentId} onChange={(e) => setForm({ ...form, assignmentId: e.target.value })}>
                  {mine.map((a) => <option key={a.id} value={a.id}>{groupLabel(db, a.groupId)} · {subjectName(db, a.subjectId)}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Título">{(id) => <Input id={id} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}</Field>
            <Field label="Instrucciones">{(id) => <Textarea id={id} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}</Field>
            <Field label="Fecha de entrega">{(id) => <Input id={id} type="date" min={todayISO()} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />}</Field>
            {error && <Notice tone="peligro">{error}</Notice>}
            <Button type="submit" icon="mas" className="w-full">Publicar tarea</Button>
          </form>
        </Card>
        <Card title="Tareas publicadas" className="lg:col-span-2 lg:order-1">
          {list.length === 0 ? (
            <EmptyState icon="tareas" title="Aún no dejas tareas" />
          ) : (
            <ul className="divide-y divide-line">
              {list.map((h) => (
                <li key={h.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-heading">{h.title}</p>
                    <p className="text-sm text-muted">{groupLabel(db, h.groupId)} · {subjectName(db, h.subjectId)} · entrega {formatDate(h.dueDate)}</p>
                    {h.description && <p className="mt-1 text-sm">{h.description}</p>}
                  </div>
                  <Button variant="fantasma" onClick={() => void act((repo) => repo.remove('homework', h.id), { action: 'Eliminó tarea', detail: h.title })}>Eliminar</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
