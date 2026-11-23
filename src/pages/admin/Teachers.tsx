import { useState, type FormEvent } from 'react'
import { Button, Card, Field, Input, Modal, Notice, PageHeader, Table, TD, TH } from '../../components/ui'
import type { Teacher } from '../../data/types'
import { uid } from '../../lib/format'
import { groupLabel, subjectName } from '../../lib/scope'
import { useApp } from '../../state/context'

export function Teachers() {
  const { db, act } = useApp()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', specialty: '', email: '', phone: '' })
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.firstName.trim() || !form.lastName.trim() || !form.specialty.trim()) return setError('Escribe nombre, apellidos y especialidad.')
    const t: Teacher = { id: uid('t'), ...form, active: true }
    await act((repo) => repo.insert('teachers', [t]), { action: 'Registró docente', detail: `${t.firstName} ${t.lastName}` })
    setForm({ firstName: '', lastName: '', specialty: '', email: '', phone: '' })
    setOpen(false)
  }

  return (
    <>
      <PageHeader title="Docentes" subtitle={`${db.teachers.length} docentes registrados`} actions={<Button icon="mas" onClick={() => setOpen(true)}>Registrar docente</Button>} />
      <Card>
        <Table caption="Catálogo de docentes">
          <thead>
            <tr>
              <th className={TH}>Docente</th>
              <th className={TH}>Grupos y materias</th>
              <th className={`${TH} hidden md:table-cell`}>Contacto</th>
            </tr>
          </thead>
          <tbody>
            {db.teachers.map((t) => {
              const homeroom = db.groups.filter((g) => g.homeroomTeacherId === t.id)
              const subjects = [...new Set(db.assignments.filter((a) => a.teacherId === t.id).map((a) => subjectName(db, a.subjectId)))]
              const groups = new Set(db.assignments.filter((a) => a.teacherId === t.id).map((a) => a.groupId))
              return (
                <tr key={t.id}>
                  <td className={TD}>
                    <p className="font-semibold text-heading">{t.firstName} {t.lastName}</p>
                    <p className="text-xs text-muted">{t.specialty}</p>
                  </td>
                  <td className={TD}>
                    {homeroom.length > 0 && <p className="text-sm">Titular: {homeroom.map((g) => groupLabel(db, g)).join(', ')}</p>}
                    <p className="text-xs text-muted">{subjects.length ? `${subjects.join(', ')} · ${groups.size} grupos` : 'Sin materias asignadas'}</p>
                  </td>
                  <td className={`${TD} hidden text-sm md:table-cell`}>
                    <p>{t.email}</p>
                    <p className="text-muted">{t.phone}</p>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Registrar docente">
        <form onSubmit={(e) => void submit(e)} className="grid gap-3 sm:grid-cols-2" noValidate>
          <Field label="Nombre(s)">{(id) => <Input id={id} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />}</Field>
          <Field label="Apellidos">{(id) => <Input id={id} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />}</Field>
          <Field label="Especialidad">{(id) => <Input id={id} value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />}</Field>
          <Field label="Teléfono">{(id) => <Input id={id} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />}</Field>
          <div className="sm:col-span-2">
            <Field label="Correo">{(id) => <Input id={id} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
          </div>
          {error && <div className="sm:col-span-2"><Notice tone="peligro">{error}</Notice></div>}
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" icon="check">Guardar docente</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
