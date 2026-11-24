import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Badge, Button, Card, EmptyState, Field, Input, Notice, PageHeader, Select, Stat, Table, Tabs, TD, TH } from '../../components/ui'
import type { Charge, ConceptKind, Level, Payment, PaymentConcept, PaymentMethod, Reminder } from '../../data/types'
import { demoDate, formatDate, formatMoney, nowISO, todayISO, uid, plural } from '../../lib/format'
import { METHOD_LABEL, chargeView, studentCharges } from '../../lib/finance'
import { LEVEL_LABEL, LEVELS, groupLabel, levelOfGroup, studentName } from '../../lib/scope'
import { useApp } from '../../state/context'

/** Siguiente referencia REF-DEMO consecutiva, para que todos los pagos tengan una. */
const nextReference = (refs: string[]) => {
  const nums = refs.map((r) => /^REF-DEMO-(\d+)$/.exec(r)?.[1]).filter((n): n is string => !!n).map(Number)
  return `REF-DEMO-${nums.length ? Math.max(...nums) + 1 : 1000}`
}

type View = 'adeudos' | 'pago' | 'cargos' | 'conceptos'

export function PayPage() {
  const [params, setParams] = useSearchParams()
  const reg = params.get('registrar')
  const view: View = reg === 'cargo' ? 'cargos' : reg ? 'pago' : ((params.get('vista') as View | null) ?? 'adeudos')
  const preStudent = params.get('alumno') ?? ''
  return (
    <>
      <PageHeader title="Pagos y cuotas" subtitle="Cargos, pagos recibidos, adeudos y recordatorios. Solo se registran pagos: no hay cobro en línea." />
      <Tabs
        label="Secciones de pagos"
        value={view}
        onChange={(v) => setParams({ vista: v })}
        options={[{ value: 'adeudos', label: 'Adeudos' }, { value: 'pago', label: 'Registrar pago' }, { value: 'cargos', label: 'Cargos' }, { value: 'conceptos', label: 'Conceptos' }]}
      />
      {view === 'adeudos' && <Debts />}
      {view === 'pago' && <RegisterPayment initialStudent={preStudent} />}
      {view === 'cargos' && <Charges initialStudent={preStudent} />}
      {view === 'conceptos' && <Concepts />}
    </>
  )
}

function Debts() {
  const { db, session, act } = useApp()
  const today = todayISO()
  const rows = useMemo(() => {
    const views = db.charges.map((c) => chargeView(db, c, today)).filter((c) => c.status === 'vencido')
    const by = new Map<string, number>()
    for (const v of views) by.set(v.studentId, (by.get(v.studentId) ?? 0) + v.balance)
    return [...by.entries()].map(([studentId, overdue]) => ({ student: db.students.find((s) => s.id === studentId)!, overdue })).filter((r) => r.student).sort((a, b) => b.overdue - a.overdue)
  }, [db, today])
  const total = rows.reduce((s, r) => s + r.overdue, 0)
  const month = today.slice(0, 7)
  const monthPaid = db.payments.filter((p) => p.paidAt.startsWith(month)).reduce((s, p) => s + p.amount, 0)
  const remindedToday = (studentId: string) => db.reminders.some((r) => r.studentId === studentId && r.createdAt.startsWith(today))

  const remind = async (list: typeof rows) => {
    const reminders: Reminder[] = list.filter((r) => !remindedToday(r.student.id)).flatMap((r) =>
      r.student.guardianIds.map((gid) => ({ id: uid('rc'), studentId: r.student.id, guardianId: gid, amount: r.overdue, createdAt: nowISO(), createdBy: session.personId, message: `Te recordamos que ${r.student.firstName} tiene un saldo vencido de ${formatMoney(r.overdue)}. Si ya pagaste, por favor ignora este mensaje.` })),
    )
    if (reminders.length === 0) return
    await act((repo) => repo.insert('reminders', reminders), { action: 'Envió recordatorios de pago', detail: plural(new Set(reminders.map((r) => r.studentId)).size, 'alumno', 'alumnos') })
  }

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Adeudo vencido" value={formatMoney(total)} icon="alerta" tone="peligro" />
        <Stat label="Alumnos con atraso" value={rows.length} icon="alumnos" tone="aviso" />
        <Stat label="Cobrado este mes" value={formatMoney(monthPaid)} icon="pagos" tone="exito" />
        <Stat label="Recordatorios enviados" value={db.reminders.length} icon="campana" tone="info" />
      </div>
      <Card title="Alumnos con saldo vencido" action={rows.length > 0 && <Button variant="secundario" icon="campana" onClick={() => void remind(rows)}>Recordar a todos</Button>}>
        {rows.length === 0 ? (
          <EmptyState icon="check" title="No hay adeudos vencidos">Todas las familias están al corriente.</EmptyState>
        ) : (
          <Table caption="Adeudos vencidos">
            <thead>
              <tr>
                <th className={TH}>Alumno</th>
                <th className={`${TH} text-right`}>Vencido</th>
                <th className={`${TH} text-right`}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.student.id}>
                  <td className={TD}>
                    <Link to={`/pagos/estado/${r.student.id}`} className="font-semibold text-link underline">{studentName(r.student)}</Link>
                    <p className="text-xs text-muted">{groupLabel(db, r.student.groupId)}</p>
                  </td>
                  <td className={`${TD} text-right font-bold whitespace-nowrap text-danger`}>{formatMoney(r.overdue)}</td>
                  <td className={`${TD} text-right`}>
                    {remindedToday(r.student.id) ? <Badge tone="exito">Recordado hoy</Badge> : <Button variant="fantasma" icon="campana" onClick={() => void remind([r])}>Recordar</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  )
}

function StudentSelect({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  const { db } = useApp()
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Elige un alumno</option>
      {LEVELS.map((l) => (
        <optgroup key={l} label={LEVEL_LABEL[l]}>
          {db.students.filter((s) => s.status === 'activo' && levelOfGroup(db, s.groupId) === l).sort((a, b) => a.lastName.localeCompare(b.lastName)).map((s) => (
            <option key={s.id} value={s.id}>{s.lastName}, {s.firstName} · {groupLabel(db, s.groupId)}</option>
          ))}
        </optgroup>
      ))}
    </Select>
  )
}

function RegisterPayment({ initialStudent }: { initialStudent: string }) {
  const { db, session, act } = useApp()
  const [studentId, setStudentId] = useState(initialStudent)
  const pending = studentId ? studentCharges(db, studentId).filter((c) => c.balance > 0) : []
  const [chargeId, setChargeId] = useState('')
  const charge = pending.find((c) => c.id === chargeId) ?? pending[0]
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('transferencia')
  const [date, setDate] = useState(todayISO())
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState<Payment | null>(null)
  const recent = [...db.payments].sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.id.localeCompare(a.id)).slice(0, 8)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!charge) return setError('Elige un alumno con un cargo pendiente.')
    const value = amount === '' ? charge.balance : Number(amount)
    if (!(value > 0)) return setError('Escribe un monto mayor a cero.')
    if (value > charge.balance + 0.001) return setError(`El monto no puede ser mayor al saldo del cargo (${formatMoney(charge.balance)}).`)
    const p: Payment = { id: uid('pg'), chargeId: charge.id, studentId, amount: Math.round(value * 100) / 100, method, paidAt: date, reference: reference.trim() || nextReference(db.payments.map((x) => x.reference)), registeredBy: session.personId, invoiceId: null }
    await act((repo) => repo.insert('payments', [p]), { action: 'Registró pago', detail: `${studentName(db.students.find((s) => s.id === studentId))} · ${charge.description} · ${formatMoney(p.amount)} · ${METHOD_LABEL[method]}` })
    setDone(p)
    setAmount('')
    setReference('')
    setChargeId('')
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card title="Registrar pago" className="h-fit lg:col-span-3">
        <form onSubmit={(e) => void submit(e)} className="space-y-3" noValidate>
          <Field label="Alumno">{(id) => <StudentSelect id={id} value={studentId} onChange={(v) => { setStudentId(v); setChargeId(''); setDone(null) }} />}</Field>
          {studentId && pending.length === 0 && <Notice tone="exito" icon="check">Este alumno no tiene cargos pendientes.</Notice>}
          {pending.length > 0 && (
            <fieldset>
              <legend className="mb-1 text-sm font-semibold text-heading">Cargo a pagar</legend>
              <ul className="space-y-2">
                {pending.map((c) => (
                  <li key={c.id}>
                    <label className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm ${charge?.id === c.id ? 'border-primary bg-info-bg/50' : 'border-line'}`}>
                      <input type="radio" name="cargo" checked={charge?.id === c.id} onChange={() => setChargeId(c.id)} className="size-5 accent-[var(--c-primary)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-heading">{c.description}</span>
                        <span className="text-xs text-muted">Vence {formatDate(c.dueDate)}{c.status === 'vencido' ? ' · vencido' : ''}</span>
                      </span>
                      <span className="font-bold whitespace-nowrap text-heading">{formatMoney(c.balance)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Monto" hint={charge ? `Saldo: ${formatMoney(charge.balance)}` : undefined}>{(id) => <Input id={id} type="number" inputMode="decimal" min={0} step={0.01} placeholder={charge ? String(charge.balance) : '0.00'} value={amount} onChange={(e) => setAmount(e.target.value)} />}</Field>
            <Field label="Forma de pago">
              {(id) => (
                <Select id={id} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta (terminal de la escuela)</option>
                </Select>
              )}
            </Field>
            <Field label="Fecha de pago">{(id) => <Input id={id} type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
            <Field label="Referencia (opcional)">{(id) => <Input id={id} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Si la dejas vacía se asigna REF-DEMO" />}</Field>
          </div>
          {error && <Notice tone="peligro">{error}</Notice>}
          {done && (
            <Notice tone="exito" icon="check">
              Pago de {formatMoney(done.amount)} registrado.{' '}
              <Link to={`/pagos/estado/${done.studentId}`} className="font-semibold underline">Ver estado de cuenta</Link> ·{' '}
              <Link to={`/facturacion?pago=${done.id}`} className="font-semibold underline">Facturar (factura electrónica demo)</Link>
            </Notice>
          )}
          <div className="flex justify-end">
            <Button type="submit" icon="check" disabled={!charge}>Registrar pago</Button>
          </div>
        </form>
      </Card>
      <Card title="Últimos pagos" className="h-fit lg:col-span-2">
        <ul className="divide-y divide-line">
          {recent.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div className="min-w-0">
                <Link to={`/pagos/estado/${p.studentId}`} className="font-semibold text-link underline">{studentName(db.students.find((s) => s.id === p.studentId))}</Link>
                <p className="text-xs text-muted">{formatDate(p.paidAt)} · {METHOD_LABEL[p.method]}</p>
              </div>
              <span className="font-semibold whitespace-nowrap text-heading">{formatMoney(p.amount)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function Charges({ initialStudent }: { initialStudent: string }) {
  const { db, act } = useApp()
  const [studentId, setStudentId] = useState(initialStudent)
  const [conceptId, setConceptId] = useState(db.concepts[0]?.id ?? '')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [msg, setMsg] = useState<{ tone: 'exito' | 'peligro'; text: string } | null>(null)
  const nextMonth = demoDate()
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  const bulkMonth = MONTHS[nextMonth.getMonth()] ?? ''
  const bulkYear = nextMonth.getFullYear()
  const bulkDesc = `Colegiatura de ${bulkMonth} ${bulkYear}`
  const bulkDue = `${bulkYear}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-10`

  const concept = db.concepts.find((c) => c.id === conceptId)
  const selectedStudent = db.students.find((s) => s.id === studentId)
  const level = selectedStudent ? levelOfGroup(db, selectedStudent.groupId) : undefined
  const suggested = concept && level ? concept.amounts[level] : undefined

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!studentId || !concept || !dueDate) return setMsg({ tone: 'peligro', text: 'Elige alumno, concepto y fecha de vencimiento.' })
    const value = amount === '' ? (suggested ?? 0) : Number(amount)
    if (!(value > 0)) return setMsg({ tone: 'peligro', text: 'El monto debe ser mayor a cero.' })
    const c: Charge = { id: uid('cg'), studentId, conceptId, description: description.trim() || concept.name, amount: value, dueDate, createdAt: nowISO() }
    await act((repo) => repo.insert('charges', [c]), { action: 'Generó cargo', detail: `${studentName(db.students.find((s) => s.id === studentId))} · ${c.description} · ${formatMoney(value)}` })
    setMsg({ tone: 'exito', text: `Cargo de ${formatMoney(value)} generado.` })
    setDescription('')
    setAmount('')
  }

  const bulk = async () => {
    const col = db.concepts.find((c) => c.kind === 'colegiatura')
    if (!col) return
    const rows: Charge[] = db.students
      .filter((s) => s.status === 'activo' && !db.charges.some((c) => c.studentId === s.id && c.description.toLowerCase() === bulkDesc.toLowerCase()))
      .map((s) => ({ id: uid('cg'), studentId: s.id, conceptId: col.id, description: bulkDesc, amount: col.amounts[levelOfGroup(db, s.groupId) ?? 'primaria'], dueDate: bulkDue, createdAt: nowISO() }))
    if (rows.length === 0) return setMsg({ tone: 'exito', text: `Todos los alumnos ya tienen la ${bulkDesc.toLowerCase()}.` })
    await act((repo) => repo.insert('charges', rows), { action: 'Generó colegiaturas', detail: `${bulkDesc} · ${plural(rows.length, 'alumno', 'alumnos')}` })
    setMsg({ tone: 'exito', text: `Se generó la ${bulkDesc.toLowerCase()} para ${plural(rows.length, 'alumno', 'alumnos')}.` })
  }

  const recent = [...db.charges].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card title="Nuevo cargo" className="h-fit lg:col-span-3">
        <form onSubmit={(e) => void submit(e)} className="space-y-3" noValidate>
          <Field label="Alumno">{(id) => <StudentSelect id={id} value={studentId} onChange={setStudentId} />}</Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Concepto">
              {(id) => (
                <Select id={id} value={conceptId} onChange={(e) => setConceptId(e.target.value)}>
                  {db.concepts.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Monto" hint={suggested ? `Tarifa del nivel: ${formatMoney(suggested)}` : 'Elige un alumno para ver la tarifa'}>{(id) => <Input id={id} type="number" min={0} step={0.01} placeholder={suggested ? String(suggested) : '0.00'} value={amount} onChange={(e) => setAmount(e.target.value)} />}</Field>
            <Field label="Descripción">{(id) => <Input id={id} placeholder={concept?.name} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
            <Field label="Vence el">{(id) => <Input id={id} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}</Field>
          </div>
          {msg && <Notice tone={msg.tone} icon={msg.tone === 'exito' ? 'check' : 'alerta'}>{msg.text}</Notice>}
          <div className="flex justify-end"><Button type="submit" icon="mas">Generar cargo</Button></div>
        </form>
      </Card>
      <div className="space-y-4 lg:col-span-2">
        <Card title="Colegiatura del mes">
          <p className="text-sm">Genera la <strong>{bulkDesc.toLowerCase()}</strong> para todos los alumnos activos con la tarifa de su nivel. Vence el {formatDate(bulkDue)}.</p>
          <Button className="mt-3 w-full" variant="secundario" icon="mas" onClick={() => void bulk()}>Generar para todos</Button>
        </Card>
        <Card title="Cargos recientes">
          <ul className="divide-y divide-line">
            {recent.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-heading">{studentName(db.students.find((s) => s.id === c.studentId))}</p>
                  <p className="text-xs text-muted">{c.description}</p>
                </div>
                <span className="font-semibold whitespace-nowrap text-heading">{formatMoney(c.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

const KIND_LABEL: Record<ConceptKind, string> = { inscripcion: 'Inscripción', colegiatura: 'Colegiatura', otro: 'Otro' }

function Concepts() {
  const { db, act } = useApp()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ConceptKind>('otro')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const value = Number(amount)
    if (!name.trim() || !(value > 0)) return setError('Escribe el nombre y un monto mayor a cero.')
    const amounts = Object.fromEntries(LEVELS.map((l) => [l, value])) as Record<Level, number>
    const c: PaymentConcept = { id: uid('cp'), name: name.trim(), kind, amounts, satProductCode: '86121500', satUnitCode: 'E48', active: true }
    await act((repo) => repo.insert('concepts', [c]), { action: 'Creó concepto de cobro', detail: `${c.name} · ${formatMoney(value)}` })
    setName('')
    setAmount('')
    setError('')
  }
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Conceptos de cobro" className="lg:col-span-2">
        <Table caption="Conceptos y tarifas por nivel">
          <thead>
            <tr>
              <th className={TH}>Concepto</th>
              {LEVELS.map((l) => <th key={l} className={`${TH} hidden text-right xl:table-cell`}>{LEVEL_LABEL[l]}</th>)}
              <th className={`${TH} text-right xl:hidden`}>Desde</th>
            </tr>
          </thead>
          <tbody>
            {db.concepts.map((c) => (
              <tr key={c.id}>
                <td className={TD}>
                  <p className="font-semibold text-heading">{c.name}</p>
                  <p className="text-xs text-muted">{KIND_LABEL[c.kind]} · Clave SAT {c.satProductCode}</p>
                </td>
                {LEVELS.map((l) => <td key={l} className={`${TD} hidden text-right whitespace-nowrap xl:table-cell`}>{formatMoney(c.amounts[l])}</td>)}
                <td className={`${TD} text-right whitespace-nowrap xl:hidden`}>{formatMoney(Math.min(...Object.values(c.amounts)))}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Card title="Nuevo concepto" className="h-fit">
        <form onSubmit={(e) => void submit(e)} className="space-y-3" noValidate>
          <Field label="Nombre">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Excursión escolar" />}</Field>
          <Field label="Tipo">
            {(id) => (
              <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as ConceptKind)}>
                <option value="inscripcion">Inscripción</option>
                <option value="colegiatura">Colegiatura</option>
                <option value="otro">Otro</option>
              </Select>
            )}
          </Field>
          <Field label="Monto (igual para todos los niveles)">{(id) => <Input id={id} type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} />}</Field>
          {error && <Notice tone="peligro">{error}</Notice>}
          <Button type="submit" icon="mas" className="w-full">Agregar concepto</Button>
        </form>
      </Card>
    </div>
  )
}
