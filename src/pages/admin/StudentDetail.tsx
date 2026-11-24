import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import { ReportCardButton } from '../../components/ReportCardButton'
import { AccessDenied } from '../../components/guards'
import { AttendanceList, GradesTable } from '../../components/StudentRecords'
import { Badge, Button, Card, DemoBadge, Field, Input, LinkButton, Modal, Notice, PageHeader, Select } from '../../components/ui'
import type { Student } from '../../data/types'
import { ageFrom, formatDate, formatMoney, nowISO } from '../../lib/format'
import { studentBalance } from '../../lib/finance'
import { LEVEL_LABEL, LEVELS, canSeeStudent, groupLabel, levelOfGroup, studentName, teacherName } from '../../lib/scope'
import { DayLog } from '../../components/DayLog'
import { StudentPhoto } from '../../components/StudentPhoto'
import { QrCode } from '../../components/QrCode'
import { formatQrCode, newQrCode, qrPayload } from '../../lib/qr'
import { useApp } from '../../state/context'

export function StudentDetail() {
  const { id = '' } = useParams()
  const { db, session, log } = useApp()
  const [modal, setModal] = useState<'editar' | 'baja' | null>(null)
  const student = db.students.find((s) => s.id === id)
  const allowed = canSeeStudent(db, session, id)
  const logged = useRef('')
  useEffect(() => {
    if (!allowed || !student || logged.current === id) return
    logged.current = id
    void log({ action: 'Consultó expediente', detail: studentName(student), kind: 'acceso' })
  }, [allowed, student, id, log])

  if (!student || !allowed) return <AccessDenied detail={`Expediente de alumno ${id}`} />
  const group = db.groups.find((g) => g.id === student.groupId)
  const guardians = db.guardians.filter((g) => student.guardianIds.includes(g.id))
  const bal = studentBalance(db, student.id)
  const isAdmin = session.role === 'admin'

  return (
    <>
      <PageHeader
        title={studentName(student)}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            {groupLabel(db, student.groupId)} · {ageFrom(student.birthDate)} años · Matrícula {student.enrollmentId} <DemoBadge />
          </span>
        }
        actions={
          isAdmin ? (
            <>
              <LinkButton to={`/pagos/estado/${student.id}`} icon="pagos">Estado de cuenta</LinkButton>
              <Button variant="secundario" icon="ajustes" onClick={() => setModal('editar')}>Editar datos</Button>
              <Button variant={student.status === 'activo' ? 'peligro' : 'secundario'} onClick={() => setModal('baja')}>{student.status === 'activo' ? 'Dar de baja' : 'Reactivar'}</Button>
            </>
          ) : undefined
        }
      />
      {student.status === 'baja' && (
        <div className="mb-4">
          <Notice tone="aviso">
            Alumno dado de baja el {formatDate(student.withdrawnAt ?? student.createdAt)}{student.withdrawReason ? ` · ${student.withdrawReason}` : ''}. Ya no aparece en listas de grupo ni en el portal familiar.
          </Notice>
        </div>
      )}
      <Modal open={modal === 'editar'} onClose={() => setModal(null)} title="Editar datos del alumno">
        <EditStudent student={student} onDone={() => setModal(null)} />
      </Modal>
      <Modal open={modal === 'baja'} onClose={() => setModal(null)} title={student.status === 'activo' ? 'Dar de baja' : 'Reactivar alumno'}>
        <Withdraw student={student} onDone={() => setModal(null)} />
      </Modal>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Datos generales">
          <StudentPhoto student={student} />
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted">Nacimiento</dt>
            <dd className="text-heading">{formatDate(student.birthDate)}</dd>
            {isAdmin && (
              <>
                <dt className="text-muted">CURP</dt>
                <dd className="break-all text-heading">{student.curp}</dd>
              </>
            )}
            <dt className="text-muted">Titular</dt>
            <dd className="text-heading">{group ? teacherName(db, group.homeroomTeacherId) : '—'}</dd>
            <dt className="text-muted">Salón</dt>
            <dd className="text-heading">{group?.room}</dd>
          </dl>
        </Card>
        <Card title="Familia" className="lg:col-span-2">
          <ul className="space-y-3">
            {guardians.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <p className="font-semibold text-heading">
                    {g.firstName} {g.lastName} <span className="font-normal text-muted">· {g.relation}</span>
                  </p>
                  <p className="text-muted">{g.phone}{isAdmin && g.email ? ` · ${g.email}` : ''}</p>
                </div>
                {g.consentAt ? <Badge tone="exito">Consentimiento firmado</Badge> : <Badge tone="aviso">Consentimiento pendiente</Badge>}
              </li>
            ))}
          </ul>
          {isAdmin && (
            <p className="mt-3 text-sm">
              Saldo pendiente: <strong className={bal.overdue > 0 ? 'text-danger' : 'text-heading'}>{formatMoney(bal.balance)}</strong>
              {bal.overdue > 0 && <span className="text-danger"> ({formatMoney(bal.overdue)} vencido)</span>}
            </p>
          )}
        </Card>
        <Card title="Asistencia reciente">
          <AttendanceList db={db} studentId={student.id} limit={6} />
        </Card>
        {isAdmin && <QrCard studentId={student.id} />}
        <Card title="Día a día" className={isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <DayLog db={db} studentId={student.id} days={3} />
        </Card>
        <Card title="Calificaciones" className="lg:col-span-2" action={<ReportCardButton studentId={student.id} />}>
          <GradesTable db={db} studentId={student.id} />
        </Card>
      </div>
      <p className="mt-4 text-sm">
        <LinkButton to={isAdmin ? '/admin/alumnos' : '/docente'} variant="fantasma" icon="izquierda">
          Volver
        </LinkButton>
      </p>
    </>
  )
}

const CURP_RE = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/

function EditStudent({ student, onDone }: { student: Student; onDone: () => void }) {
  const { db, act } = useApp()
  const [form, setForm] = useState({ firstName: student.firstName, lastName: student.lastName, birthDate: student.birthDate, curp: student.curp === 'PENDIENTE' ? '' : student.curp, groupId: student.groupId })
  const [error, setError] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const curp = form.curp.trim().toUpperCase()
    if (!form.firstName.trim() || !form.lastName.trim() || !form.birthDate) return setError('Completa nombre, apellidos y fecha de nacimiento.')
    if (curp && !CURP_RE.test(curp)) return setError('La CURP no tiene el formato correcto (18 caracteres).')
    const changes: string[] = []
    if (form.groupId !== student.groupId) changes.push(`cambio de grupo a ${groupLabel(db, form.groupId)}`)
    if (`${form.firstName} ${form.lastName}` !== `${student.firstName} ${student.lastName}`) changes.push('nombre')
    if (curp !== student.curp && curp) changes.push('CURP')
    if (form.birthDate !== student.birthDate) changes.push('fecha de nacimiento')
    await act((repo) => repo.update('students', student.id, { firstName: form.firstName.trim(), lastName: form.lastName.trim(), birthDate: form.birthDate, curp: curp || 'PENDIENTE', groupId: form.groupId }), { action: 'Editó datos de alumno', detail: `${studentName(student)}${changes.length ? ` · ${changes.join(', ')}` : ''}` })
    onDone()
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-3 sm:grid-cols-2" noValidate>
      <Field label="Nombre(s)">{(id) => <Input id={id} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />}</Field>
      <Field label="Apellidos">{(id) => <Input id={id} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />}</Field>
      <Field label="Fecha de nacimiento">{(id) => <Input id={id} type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />}</Field>
      <Field label="CURP">{(id) => <Input id={id} value={form.curp} maxLength={18} onChange={(e) => setForm({ ...form, curp: e.target.value.toUpperCase() })} />}</Field>
      <div className="sm:col-span-2">
        <Field label="Grupo" hint="Al cambiar de grupo, el historial de asistencia y calificaciones se conserva.">
          {(id) => (
            <Select id={id} value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}>
              {LEVELS.map((l) => (
                <optgroup key={l} label={LEVEL_LABEL[l]}>
                  {db.groups.filter((g) => levelOfGroup(db, g.id) === l).map((g) => <option key={g.id} value={g.id}>{groupLabel(db, g)}</option>)}
                </optgroup>
              ))}
            </Select>
          )}
        </Field>
      </div>
      {error && <div className="sm:col-span-2"><Notice tone="peligro">{error}</Notice></div>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button variant="secundario" onClick={onDone}>Cancelar</Button>
        <Button type="submit" icon="check">Guardar cambios</Button>
      </div>
    </form>
  )
}

const REASONS = ['Cambio de escuela', 'Cambio de domicilio', 'Motivos económicos', 'Motivos personales', 'Otro']

function Withdraw({ student, onDone }: { student: Student; onDone: () => void }) {
  const { act } = useApp()
  const [reason, setReason] = useState(REASONS[0]!)
  const active = student.status === 'activo'
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (active) await act((repo) => repo.update('students', student.id, { status: 'baja', withdrawnAt: nowISO(), withdrawReason: reason }), { action: 'Dio de baja alumno', detail: `${studentName(student)} · ${reason}` })
    else await act((repo) => repo.update('students', student.id, { status: 'activo', withdrawnAt: undefined, withdrawReason: undefined }), { action: 'Reactivó alumno', detail: studentName(student) })
    onDone()
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3">
      {active ? (
        <>
          <p>{studentName(student)} dejará de aparecer en las listas de su grupo y en el portal de su familia. Su historial y su estado de cuenta se conservan.</p>
          <Field label="Motivo de la baja">
            {(id) => (
              <Select id={id} value={reason} onChange={(e) => setReason(e.target.value)}>
                {REASONS.map((r) => <option key={r}>{r}</option>)}
              </Select>
            )}
          </Field>
        </>
      ) : (
        <p>{studentName(student)} volverá a aparecer en su grupo y en el portal de su familia.</p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secundario" onClick={onDone}>Cancelar</Button>
        <Button type="submit" variant={active ? 'peligro' : 'primario'}>{active ? 'Confirmar baja' : 'Reactivar alumno'}</Button>
      </div>
    </form>
  )
}

/** Credencial QR del alumno; la dirección puede generar una nueva si se perdió. */
function QrCard({ studentId }: { studentId: string }) {
  const { db, act } = useApp()
  const [confirm, setConfirm] = useState(false)
  const student = db.students.find((s) => s.id === studentId)
  if (!student) return null
  const regenerate = async () => {
    const code = newQrCode(db.students.map((s) => s.qrCode))
    await act((repo) => repo.update('students', student.id, { qrCode: code }), { action: 'Generó credencial QR nueva', detail: `${studentName(student)} · la anterior dejó de funcionar` })
    setConfirm(false)
  }
  return (
    <Card title="Credencial QR">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="rounded-xl bg-white p-2"><QrCode value={qrPayload(student.qrCode)} size={150} label={`Código QR de ${studentName(student)}`} /></div>
        <p className="font-mono text-lg font-bold tracking-widest text-heading">{formatQrCode(student.qrCode)}</p>
        {confirm ? (
          <div className="space-y-2">
            <p className="text-sm">La credencial actual dejará de funcionar. ¿Continuar?</p>
            <div className="flex justify-center gap-2">
              <Button variant="secundario" onClick={() => setConfirm(false)}>Cancelar</Button>
              <Button variant="peligro" onClick={() => void regenerate()}>Sí, generar nueva</Button>
            </div>
          </div>
        ) : (
          <Button variant="secundario" icon="qr" onClick={() => setConfirm(true)}>Generar credencial nueva</Button>
        )}
      </div>
    </Card>
  )
}
