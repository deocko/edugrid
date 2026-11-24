import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Notice, PageHeader, Select, Table, TD, TH } from '../../components/ui'
import type { Guardian, Level, Student } from '../../data/types'
import { formatMoney, nowISO, uid } from '../../lib/format'
import { studentBalance } from '../../lib/finance'
import { LEVEL_LABEL, LEVELS, groupLabel, levelOfGroup, studentName } from '../../lib/scope'
import { useApp } from '../../state/context'

const CURP_RE = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/

export function Students() {
  const { db } = useApp()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [level, setLevel] = useState<Level | ''>('')
  const [groupId, setGroupId] = useState('')
  const [showWithdrawn, setShowWithdrawn] = useState(false)
  const [created, setCreated] = useState<Student | null>(null)
  const open = params.get('alta') === '1'

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return db.students
      .filter((s) => (showWithdrawn ? s.status === 'baja' : s.status === 'activo'))
      .filter((s) => !level || levelOfGroup(db, s.groupId) === level)
      .filter((s) => !groupId || s.groupId === groupId)
      .filter((s) => !term || `${studentName(s)} ${s.enrollmentId}`.toLowerCase().includes(term))
      .sort((a, b) => a.lastName.localeCompare(b.lastName))
  }, [db, q, level, groupId, showWithdrawn])

  return (
    <>
      <PageHeader
        title="Alumnos"
        subtitle={`${db.students.filter((s) => s.status === 'activo').length} alumnos inscritos en el ciclo actual`}
        actions={
          <Button icon="mas" onClick={() => setParams({ alta: '1' })}>
            Inscribir alumno
          </Button>
        }
      />
      {created && (
        <div className="mb-4">
          <Notice tone="exito" icon="check">
            <strong>{studentName(created)}</strong> quedó inscrito en {groupLabel(db, created.groupId)}.{' '}
            <Link to={`/alumnos/${created.id}`} className="font-semibold underline">
              Ver expediente
            </Link>{' '}
            ·{' '}
            <Link to={`/pagos?registrar=cargo&alumno=${created.id}`} className="font-semibold underline">
              Generar cargo
            </Link>
          </Notice>
        </div>
      )}
      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Field label="Buscar">{(id) => <Input id={id} type="search" placeholder="Nombre o matrícula" value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
          <Field label="Nivel">
            {(id) => (
              <Select id={id} value={level} onChange={(e) => { setLevel(e.target.value as Level | ''); setGroupId('') }}>
                <option value="">Todos los niveles</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{LEVEL_LABEL[l]}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Grupo">
            {(id) => (
              <Select id={id} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">Todos los grupos</option>
                {db.groups.filter((g) => !level || levelOfGroup(db, g.id) === level).map((g) => (
                  <option key={g.id} value={g.id}>{groupLabel(db, g)}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <label className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={showWithdrawn} onChange={(e) => setShowWithdrawn(e.target.checked)} className="size-5 accent-[var(--c-primary)]" />
          Ver alumnos dados de baja ({db.students.filter((s) => s.status === 'baja').length})
        </label>
        {list.length === 0 ? (
          <EmptyState icon="buscar" title={showWithdrawn ? 'No hay alumnos dados de baja' : 'No encontramos alumnos'}>{showWithdrawn ? 'Cuando des de baja a un alumno, aparecerá aquí.' : 'Prueba con otro nombre o quita los filtros.'}</EmptyState>
        ) : (
          <Table caption="Lista de alumnos">
            <thead>
              <tr>
                <th className={TH}>Alumno</th>
                <th className={TH}>Grupo</th>
                <th className={`${TH} hidden md:table-cell`}>Consentimiento</th>
                <th className={`${TH} text-right`}>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => {
                const bal = studentBalance(db, s.id)
                const consent = s.guardianIds.every((gid) => db.guardians.find((g) => g.id === gid)?.consentAt)
                return (
                  <tr key={s.id}>
                    <td className={TD}>
                      <Link to={`/alumnos/${s.id}`} className="font-semibold text-link underline">
                        {studentName(s)}
                      </Link>
                      <p className="text-xs text-muted">{s.enrollmentId}</p>
                    </td>
                    <td className={TD}>{groupLabel(db, s.groupId)}</td>
                    <td className={`${TD} hidden md:table-cell`}>{consent ? <Badge tone="exito">Firmado</Badge> : <Badge tone="aviso">Pendiente</Badge>}</td>
                    <td className={`${TD} text-right font-semibold whitespace-nowrap ${bal.overdue > 0 ? 'text-danger' : 'text-heading'}`}>{formatMoney(bal.balance)}</td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>
      <Modal open={open} onClose={() => setParams({})} title="Inscribir alumno">
        <EnrollForm
          onDone={(s) => {
            setCreated(s)
            setParams({})
          }}
        />
      </Modal>
    </>
  )
}

function EnrollForm({ onDone }: { onDone: (s: Student) => void }) {
  const { db, act } = useApp()
  const [form, setForm] = useState({ firstName: '', lastName: '', birthDate: '', curp: '', groupId: '', guardianMode: 'nuevo' as 'nuevo' | 'existente', guardianId: '', gFirst: '', gLast: '', gRelation: 'Madre' as Guardian['relation'], gEmail: '', gPhone: '', consent: false })
  const [error, setError] = useState('')
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const curp = form.curp.trim().toUpperCase()
    if (!form.firstName.trim() || !form.lastName.trim() || !form.birthDate || !form.groupId) return setError('Completa nombre, apellidos, fecha de nacimiento y grupo.')
    if (curp && !CURP_RE.test(curp)) return setError('La CURP no tiene el formato correcto (18 caracteres).')
    if (form.guardianMode === 'nuevo' && (!form.gFirst.trim() || !form.gLast.trim() || !form.gPhone.trim())) return setError('Escribe nombre, apellidos y teléfono de la madre, padre o tutor.')
    if (form.guardianMode === 'existente' && !form.guardianId) return setError('Elige a la madre, padre o tutor.')
    if (!form.consent) return setError('Para inscribir a un menor se necesita el consentimiento de su madre, padre o tutor.')

    const now = nowISO()
    let guardianId = form.guardianId
    const newGuardian: Guardian | null =
      form.guardianMode === 'nuevo'
        ? { id: uid('tu'), firstName: form.gFirst.trim(), lastName: form.gLast.trim(), relation: form.gRelation, email: form.gEmail.trim(), phone: form.gPhone.trim(), rfc: 'XAXX010101000', taxName: 'PUBLICO EN GENERAL', taxZip: db.meta.cfdiConfig.codigoPostal, taxRegime: '616', consentAt: now }
        : null
    if (newGuardian) guardianId = newGuardian.id
    const seq = db.students.length + 1
    const student: Student = { id: uid('al'), firstName: form.firstName.trim(), lastName: form.lastName.trim(), birthDate: form.birthDate, curp: curp || 'PENDIENTE', groupId: form.groupId, guardianIds: [guardianId], enrollmentId: `DEMO-${String(seq).padStart(4, '0')}`, status: 'activo', createdAt: now }
    await act(
      async (repo) => {
        if (newGuardian) await repo.insert('guardians', [newGuardian])
        else await repo.update('guardians', guardianId, { consentAt: db.guardians.find((g) => g.id === guardianId)?.consentAt ?? now })
        await repo.insert('students', [student])
      },
      { action: 'Inscribió alumno', detail: `${studentName(student)} en ${groupLabel(db, student.groupId)}` },
    )
    onDone(student)
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-bold text-heading">Datos del alumno</legend>
        <Field label="Nombre(s)">{(id) => <Input id={id} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} autoComplete="off" />}</Field>
        <Field label="Apellidos">{(id) => <Input id={id} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} autoComplete="off" />}</Field>
        <Field label="Fecha de nacimiento">{(id) => <Input id={id} type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} />}</Field>
        <Field label="CURP (opcional)" hint="Puedes capturarla después">{(id) => <Input id={id} value={form.curp} maxLength={18} onChange={(e) => set('curp', e.target.value.toUpperCase())} />}</Field>
        <div className="sm:col-span-2">
          <Field label="Grupo">
            {(id) => (
              <Select id={id} value={form.groupId} onChange={(e) => set('groupId', e.target.value)}>
                <option value="">Elige un grupo</option>
                {LEVELS.map((l) => (
                  <optgroup key={l} label={LEVEL_LABEL[l]}>
                    {db.groups.filter((g) => levelOfGroup(db, g.id) === l).map((g) => (
                      <option key={g.id} value={g.id}>{groupLabel(db, g)}</option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-bold text-heading">Madre, padre o tutor</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="inline-flex min-h-11 items-center gap-2">
            <input type="radio" name="gmode" checked={form.guardianMode === 'nuevo'} onChange={() => set('guardianMode', 'nuevo')} className="size-5 accent-[var(--c-primary)]" /> Registrar nuevo
          </label>
          <label className="inline-flex min-h-11 items-center gap-2">
            <input type="radio" name="gmode" checked={form.guardianMode === 'existente'} onChange={() => set('guardianMode', 'existente')} className="size-5 accent-[var(--c-primary)]" /> Ya está registrado (hermanos)
          </label>
        </div>
        {form.guardianMode === 'existente' ? (
          <Field label="Tutor registrado">
            {(id) => (
              <Select id={id} value={form.guardianId} onChange={(e) => set('guardianId', e.target.value)}>
                <option value="">Elige</option>
                {[...db.guardians].sort((a, b) => a.lastName.localeCompare(b.lastName)).map((g) => (
                  <option key={g.id} value={g.id}>{g.lastName}, {g.firstName}</option>
                ))}
              </Select>
            )}
          </Field>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre(s)">{(id) => <Input id={id} value={form.gFirst} onChange={(e) => set('gFirst', e.target.value)} />}</Field>
            <Field label="Apellidos">{(id) => <Input id={id} value={form.gLast} onChange={(e) => set('gLast', e.target.value)} />}</Field>
            <Field label="Parentesco">
              {(id) => (
                <Select id={id} value={form.gRelation} onChange={(e) => set('gRelation', e.target.value as Guardian['relation'])}>
                  <option>Madre</option>
                  <option>Padre</option>
                  <option>Tutora</option>
                  <option>Tutor</option>
                </Select>
              )}
            </Field>
            <Field label="Teléfono">{(id) => <Input id={id} type="tel" value={form.gPhone} onChange={(e) => set('gPhone', e.target.value)} />}</Field>
            <div className="sm:col-span-2">
              <Field label="Correo (opcional)">{(id) => <Input id={id} type="email" value={form.gEmail} onChange={(e) => set('gEmail', e.target.value)} />}</Field>
            </div>
          </div>
        )}
      </fieldset>

      <label className="flex items-start gap-3 rounded-xl bg-surface-2 p-3 text-sm">
        <input type="checkbox" checked={form.consent} onChange={(e) => set('consent', e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--c-primary)]" />
        <span>
          La madre, padre o tutor leyó el{' '}
          <Link to="/privacidad" className="font-semibold text-link underline" target="_blank">
            aviso de privacidad
          </Link>{' '}
          y da su consentimiento para tratar los datos del menor.
        </span>
      </label>

      {error && <Notice tone="peligro">{error}</Notice>}
      <div className="flex justify-end">
        <Button type="submit" icon="check">
          Inscribir alumno
        </Button>
      </div>
    </form>
  )
}
