import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Badge, Button, Card, Field, Input, Modal, Notice, PageHeader, Table, Switch, TD, TH } from '../../components/ui'
import type { Teacher } from '../../data/types'
import { uid, plural } from '../../lib/format'
import { groupLabel, subjectName } from '../../lib/scope'
import { useApp } from '../../state/context'

type Draft = Omit<Teacher, 'id' | 'active'>
const EMPTY: Draft = { firstName: '', lastName: '', specialty: '', email: '', phone: '' }

export function Teachers() {
  const { db } = useApp()
  const [editing, setEditing] = useState<Teacher | 'nuevo' | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const list = db.teachers.filter((t) => (showInactive ? !t.active : t.active))

  return (
    <>
      <PageHeader title="Docentes" subtitle={plural(db.teachers.filter((t) => t.active).length, 'docente activo', 'docentes activos')} actions={<Button icon="mas" onClick={() => setEditing('nuevo')}>Registrar docente</Button>} />
      <Card>
        <Switch className="mb-3" checked={showInactive} onChange={setShowInactive} label={`Mostrar docentes dados de baja (${db.teachers.filter((t) => !t.active).length})`} />
        <Table caption="Catálogo de docentes">
          <thead>
            <tr>
              <th className={TH}>Docente</th>
              <th className={TH}>Grupos y materias</th>
              <th className={`${TH} hidden md:table-cell`}>Contacto</th>
              <th className={`${TH} text-right`}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td className={TD} colSpan={4}>
                  <p className="py-4 text-center text-muted">{showInactive ? 'No hay docentes dados de baja.' : 'No hay docentes activos.'}</p>
                </td>
              </tr>
            )}
            {list.map((t) => {
              const homeroom = db.groups.filter((g) => g.homeroomTeacherId === t.id)
              const subjects = [...new Set(db.assignments.filter((a) => a.teacherId === t.id).map((a) => subjectName(db, a.subjectId)))]
              const groups = new Set(db.assignments.filter((a) => a.teacherId === t.id).map((a) => a.groupId))
              return (
                <tr key={t.id}>
                  <td className={TD}>
                    <p className="font-semibold text-heading">{t.firstName} {t.lastName}</p>
                    <p className="text-xs text-muted">{t.specialty}</p>
                    {!t.active && <Badge tone="aviso">Baja</Badge>}
                  </td>
                  <td className={TD}>
                    {homeroom.length > 0 && <p className="text-sm">Titular: {homeroom.map((g) => groupLabel(db, g)).join(', ')}</p>}
                    <p className="text-xs text-muted">{subjects.length ? `${subjects.join(', ')} · ${plural(groups.size, 'grupo', 'grupos')}` : 'Sin materias asignadas'}</p>
                  </td>
                  <td className={`${TD} hidden text-sm md:table-cell`}>
                    <p className="break-all">{t.email}</p>
                    <p className="text-muted">{t.phone}</p>
                  </td>
                  <td className={`${TD} text-right`}>
                    <Button variant="fantasma" onClick={() => setEditing(t)} aria-label={`Editar a ${t.firstName} ${t.lastName}`}>Editar</Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Table>
        <p className="mt-3 text-sm text-muted">
          Para cambiar qué docente da cada materia, ve a <Link to="/admin/escuela" className="font-semibold text-link underline">Ciclos y grupos</Link> → Materias y docentes del grupo.
        </p>
      </Card>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'nuevo' ? 'Registrar docente' : 'Editar docente'}>
        {editing !== null && <TeacherForm teacher={editing === 'nuevo' ? null : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </>
  )
}

function TeacherForm({ teacher, onDone }: { teacher: Teacher | null; onDone: () => void }) {
  const { db, act } = useApp()
  const [form, setForm] = useState<Draft>(teacher ? { firstName: teacher.firstName, lastName: teacher.lastName, specialty: teacher.specialty, email: teacher.email, phone: teacher.phone } : EMPTY)
  const [error, setError] = useState('')
  const busy = teacher ? db.groups.filter((g) => g.homeroomTeacherId === teacher.id).length + db.assignments.filter((a) => a.teacherId === teacher.id).length : 0

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.firstName.trim() || !form.lastName.trim() || !form.specialty.trim()) return setError('Escribe nombre, apellidos y especialidad.')
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('El correo no tiene un formato válido.')
    const name = `${form.firstName} ${form.lastName}`
    if (teacher) await act((repo) => repo.update('teachers', teacher.id, form), { action: 'Editó docente', detail: name })
    else await act((repo) => repo.insert('teachers', [{ id: uid('t'), ...form, active: true }]), { action: 'Registró docente', detail: name })
    onDone()
  }

  const toggleActive = async () => {
    if (!teacher) return
    await act((repo) => repo.update('teachers', teacher.id, { active: !teacher.active }), { action: teacher.active ? 'Dio de baja docente' : 'Reactivó docente', detail: `${teacher.firstName} ${teacher.lastName}` })
    onDone()
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-3 sm:grid-cols-2" noValidate>
      <Field label="Nombre(s)">{(id) => <Input id={id} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />}</Field>
      <Field label="Apellidos">{(id) => <Input id={id} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />}</Field>
      <Field label="Especialidad">{(id) => <Input id={id} value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />}</Field>
      <Field label="Teléfono">{(id) => <Input id={id} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />}</Field>
      <div className="sm:col-span-2">
        <Field label="Correo">{(id) => <Input id={id} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
      </div>
      {error && <div className="sm:col-span-2"><Notice tone="peligro">{error}</Notice></div>}
      {teacher?.active && busy > 0 && (
        <div className="sm:col-span-2">
          <Notice tone="info">Para dar de baja a este docente, primero reasigna sus grupos y materias ({busy}) en Ciclos y grupos.</Notice>
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
        {teacher && (
          <Button variant={teacher.active ? 'peligro' : 'secundario'} disabled={teacher.active && busy > 0} onClick={() => void toggleActive()}>
            {teacher.active ? 'Dar de baja' : 'Reactivar'}
          </Button>
        )}
        <Button type="submit" icon="check">Guardar</Button>
      </div>
    </form>
  )
}
