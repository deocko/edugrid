import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Badge, Button, Card, Field, Input, Modal, Notice, PageHeader, Table, Switch, TD, TH } from '../../components/ui'
import type { Database, Teacher, TeachingAssignment } from '../../data/types'
import type { EdugridRepository } from '../../data/repository'
import { uid, plural } from '../../lib/format'
import { LEVEL_LABEL, groupLabel, levelOfGroup, schoolLevels } from '../../lib/scope'
import { useApp } from '../../state/context'
import { ImportarExcel, ListaInvitaciones } from '../../components/ImportarExcel'
import { useInvitar } from '../../lib/invitar'
import type { ResultadoInvitacion } from '../../data/cuentaTipos'
import { BotonExportar } from '../../components/BotonExportar'
import { InvitacionesModulo } from '../../components/Invitaciones'

type Draft = Omit<Teacher, 'id' | 'active' | 'subjectIds' | 'profilePhoto'>

/** Materias de la ficha del docente: las elegidas en el formulario y las que da en algún grupo. */
const teacherSubjects = (db: Database, t: Teacher) => [...new Set([...(t.subjectIds ?? []), ...db.assignments.filter((a) => a.teacherId === t.id).map((a) => a.subjectId)])].filter((id) => db.subjects.some((s) => s.id === id))

const subjectLabel = (db: Database, id: string) => {
  const s = db.subjects.find((x) => x.id === id)
  const repetida = s && db.subjects.some((x) => x.id !== s.id && x.name === s.name)
  return s ? (repetida ? `${s.name} (${LEVEL_LABEL[s.level]})` : s.name) : 'Materia'
}

/** Grupos del ciclo actual del nivel de la materia que todavía no tienen docente para ella. */
const freeGroups = (db: Database, subjectId: string) => {
  const s = db.subjects.find((x) => x.id === subjectId)
  const ciclo = db.cycles.find((c) => c.active)
  return db.groups.filter((g) => (!ciclo || g.cycleId === ciclo.id) && levelOfGroup(db, g.id) === s?.level && !db.assignments.some((a) => a.groupId === g.id && a.subjectId === subjectId))
}

/** Lo que cambia al guardar las materias: grupos libres que se le asignan y asignaciones que se le quitan. */
function subjectChanges(db: Database, teacherId: string, before: string[], after: string[]) {
  const added = after.filter((id) => !before.includes(id))
  const removed = before.filter((id) => !after.includes(id))
  const inserts: TeachingAssignment[] = added.flatMap((sid) => freeGroups(db, sid).map((g) => ({ id: uid('a'), groupId: g.id, subjectId: sid, teacherId })))
  const removes = db.assignments.filter((a) => a.teacherId === teacherId && removed.includes(a.subjectId))
  return {
    inserts,
    removes,
    apply: async (repo: EdugridRepository) => {
      if (inserts.length) await repo.insert('assignments', inserts)
      for (const a of removes) await repo.remove('assignments', a.id)
    },
  }
}
const EMPTY: Draft = { firstName: '', lastName: '', specialty: '', email: '', phone: '' }

export function Teachers() {
  const { db } = useApp()
  const [editing, setEditing] = useState<Teacher | 'nuevo' | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [invitadas, setInvitadas] = useState<ResultadoInvitacion[]>([])
  const list = db.teachers.filter((t) => (showInactive ? !t.active : t.active))

  return (
    <>
      <PageHeader title="Docentes" subtitle={plural(db.teachers.filter((t) => t.active).length, 'docente activo', 'docentes activos')} actions={<><Button icon="mas" onClick={() => setEditing('nuevo')}>Registrar docente</Button><ImportarExcel tipo="docentes" />
        <BotonExportar
          datos={() => ({
            archivo: showInactive ? 'docentes-dados-de-baja' : 'docentes',
            hoja: 'Docentes',
            columnas: ['Docente', 'Especialidad', 'Estado', 'Titular de', 'Materias', 'Grupos', 'Correo', 'Teléfono'],
            filas: list.map((t) => [
              `${t.firstName} ${t.lastName}`,
              t.specialty,
              t.active ? 'Activo' : 'Baja',
              db.groups.filter((g) => g.homeroomTeacherId === t.id).map((g) => groupLabel(db, g)).join(', '),
              teacherSubjects(db, t).map((id) => subjectLabel(db, id)).join(', ') || 'Sin materias asignadas',
              new Set(db.assignments.filter((a) => a.teacherId === t.id).map((a) => a.groupId)).size,
              t.email,
              t.phone,
            ]),
          })}
        /></>} />
      {invitadas.length > 0 && <Card className="mb-4"><ListaInvitaciones resultados={invitadas} /></Card>}
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
              const subjects = teacherSubjects(db, t).map((id) => `${subjectLabel(db, id)}${db.assignments.some((a) => a.teacherId === t.id && a.subjectId === id) ? '' : ' (sin grupo)'}`)
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
                    <p className="text-xs text-muted" data-materias-docente>{subjects.length ? `${subjects.join(', ')} · ${plural(groups.size, 'grupo', 'grupos')}` : 'Sin materias asignadas'}</p>
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
      <InvitacionesModulo tipo="docente" />
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'nuevo' ? 'Registrar docente' : 'Editar docente'}>
        {editing !== null && <TeacherForm teacher={editing === 'nuevo' ? null : editing} onDone={(r) => { setEditing(null); setInvitadas(r ?? []) }} />}
      </Modal>
    </>
  )
}

function TeacherForm({ teacher, onDone }: { teacher: Teacher | null; onDone: (invitadas?: ResultadoInvitacion[]) => void }) {
  const { db, act, esDemo } = useApp()
  const invitar = useInvitar()
  const [form, setForm] = useState<Draft>(teacher ? { firstName: teacher.firstName, lastName: teacher.lastName, specialty: teacher.specialty, email: teacher.email, phone: teacher.phone } : EMPTY)
  const before = teacher ? teacherSubjects(db, teacher) : []
  const [materias, setMaterias] = useState<string[]>(before)
  const [error, setError] = useState('')
  const toggleMateria = (id: string) => setMaterias((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]))
  const niveles = schoolLevels(db)
  const busy = teacher ? db.groups.filter((g) => g.homeroomTeacherId === teacher.id).length + db.assignments.filter((a) => a.teacherId === teacher.id).length : 0

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.firstName.trim() || !form.lastName.trim() || !form.specialty.trim()) return setError('Escribe nombre, apellidos y especialidad.')
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('El correo no tiene un formato válido.')
    const name = `${form.firstName} ${form.lastName}`
    const id = teacher?.id ?? uid('t')
    const cambios = subjectChanges(db, id, before, materias)
    const detalle = `${name}${materias.length ? ` · materias: ${materias.map((m) => subjectLabel(db, m)).join(', ')}` : ' · sin materias'}${cambios.inserts.length ? ` · ${plural(cambios.inserts.length, 'grupo asignado', 'grupos asignados')}` : ''}`
    if (teacher)
      return void (await act(async (repo) => { await repo.update('teachers', teacher.id, { ...form, subjectIds: materias }); await cambios.apply(repo) }, { action: 'Editó docente', detail: detalle }), onDone())
    await act(async (repo) => { await repo.insert('teachers', [{ id, ...form, subjectIds: materias, active: true }]); await cambios.apply(repo) }, { action: 'Registró docente', detail: detalle })
    // Con correo, recibe su invitación para crear su contraseña.
    onDone(await invitar([{ tipo: 'docente', referencia: id, correo: form.email.trim().toLowerCase(), nombre: name }]))
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
      <fieldset className="sm:col-span-2" data-campo-materias>
        <legend className="mb-1 text-sm font-semibold text-heading">Materias ({materias.length})</legend>
        <p className="mb-2 text-xs text-muted">Elige una o varias. Se le asignan en los grupos del ciclo actual que todavía no tienen docente para esa materia; después puedes ajustarlo en Ciclos y grupos → Materias y docentes del grupo.</p>
        {db.subjects.length === 0 ? (
          <p className="text-sm text-muted">La escuela todavía no tiene materias. Agrégalas en Ciclos y grupos → Materias.</p>
        ) : (
          <div className="max-h-60 space-y-3 overflow-y-auto rounded-xl border border-line p-2">
            {niveles.map((l) => {
              const del = db.subjects.filter((x) => x.level === l)
              if (del.length === 0) return null
              return (
                <div key={l}>
                  <p className="px-2 text-xs font-bold tracking-wide text-muted uppercase">{LEVEL_LABEL[l]}</p>
                  <ul>
                    {del.map((m) => {
                      const elegida = materias.includes(m.id)
                      const libres = freeGroups(db, m.id).length
                      const nueva = elegida && !before.includes(m.id)
                      return (
                        <li key={m.id}>
                          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-surface-2">
                            <input type="checkbox" checked={elegida} onChange={() => toggleMateria(m.id)} className="size-5 shrink-0 accent-[var(--c-primary)]" />
                            <span className="min-w-0">
                              <span className="font-semibold text-heading">{m.name}</span>
                              {nueva && <span className="block text-xs text-muted">{libres ? `Se asignará en ${plural(libres, 'grupo', 'grupos')} sin docente de ${m.name}.` : 'Todos los grupos ya tienen docente de esta materia: queda en su ficha y la asignas por grupo.'}</span>}
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </fieldset>
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
        {teacher && !esDemo && teacher.email && (
          <Button variant="secundario" icon="enviar" onClick={() => void invitar([{ tipo: 'docente', referencia: teacher.id, correo: teacher.email.toLowerCase(), nombre: `${teacher.firstName} ${teacher.lastName}` }]).then(onDone)}>
            Enviar invitación
          </Button>
        )}
        <Button type="submit" icon="check">Guardar</Button>
      </div>
    </form>
  )
}
