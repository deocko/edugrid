import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { MOTIVOS_CANCELACION, REGIMENES, RFC_PUBLICO_GENERAL, RFC_RE, USOS_CFDI } from '../../cfdi/catalogs'
import { getPacAdapter } from '../../cfdi/pac'
import { emitInvoice } from '../../cfdi/service'
import { InvoiceActions } from '../../components/InvoiceActions'
import { Badge, Button, Card, DemoBadge, EmptyState, Field, Input, LinkButton, Modal, Notice, PageHeader, Select } from '../../components/ui'
import type { Invoice, Payment } from '../../data/types'
import { formatDate, formatDateTime, formatMoney, uid } from '../../lib/format'
import { METHOD_LABEL } from '../../lib/finance'
import { studentName } from '../../lib/scope'
import { useApp } from '../../state/context'

export function InvoicesPage() {
  const { db } = useApp()
  const [params, setParams] = useSearchParams()
  const paymentId = params.get('pago')
  const payment = db.payments.find((p) => p.id === paymentId)
  const [cancel, setCancel] = useState<Invoice | null>(null)
  const [picker, setPicker] = useState(false)
  const list = [...db.invoices].sort((a, b) => b.folio - a.folio)
  const uninvoiced = [...db.payments].filter((p) => !p.invoiceId).sort((a, b) => b.paidAt.localeCompare(a.paidAt)).slice(0, 15)

  return (
    <>
      <PageHeader
        title="Facturación"
        subtitle={<span className="inline-flex flex-wrap items-center gap-2">Facturas electrónicas (CFDI 4.0) en modo demostración <DemoBadge /></span>}
        actions={
          <>
            <Button icon="factura" onClick={() => setPicker(true)}>Facturar un pago</Button>
            <LinkButton to="/facturacion/configuracion" variant="secundario" icon="ajustes">Configuración</LinkButton>
          </>
        }
      />
      <div className="mb-4 space-y-2">
        <Notice tone="aviso" icon="alerta">
          <strong>Modo de pruebas:</strong> las facturas se generan con datos ficticios y un timbre de prueba. No se envían al SAT ni a ningún PAC y no tienen validez fiscal.
        </Notice>
        <Notice tone="info" icon="ajustes">
          <strong>Configuración incompleta:</strong> falta cargar el certificado del SAT (CSD) y contratar un PAC real. Mientras tanto se usa el PAC DEMO. <Link to="/facturacion/configuracion" className="font-semibold underline">Ver configuración</Link>
        </Notice>
      </div>
      <Card title="Palabras que vas a ver" className="mb-4">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div><dt className="inline font-semibold text-heading">CFDI: </dt><dd className="inline">factura electrónica.</dd></div>
          <div><dt className="inline font-semibold text-heading">CSD: </dt><dd className="inline">certificado del SAT con el que la escuela firma sus facturas.</dd></div>
          <div><dt className="inline font-semibold text-heading">PAC: </dt><dd className="inline">proveedor que timbra la factura (le pone el folio fiscal).</dd></div>
          <div><dt className="inline font-semibold text-heading">PUE: </dt><dd className="inline">pago en una sola exhibición.</dd></div>
        </dl>
      </Card>
      <Card title={`Facturas emitidas (${list.length})`}>
        {list.length === 0 ? (
          <EmptyState icon="factura" title="Aún no hay facturas" action={<Button variant="secundario" onClick={() => setPicker(true)}>Facturar un pago</Button>}>
            Registra un pago y factúralo para ver aquí el XML y el PDF de demostración.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((inv) => (
              <li key={inv.id} className="flex flex-col gap-2 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-heading">
                    {inv.serie}-{inv.folio} · {formatMoney(inv.total)}
                    {inv.status === 'vigente' ? <Badge tone="exito">Vigente</Badge> : <Badge tone="peligro">Cancelada</Badge>}
                  </p>
                  <p className="text-sm text-muted">{inv.receptorNombre} · {inv.receptorRfc} · {formatDateTime(inv.fecha)}</p>
                  <p className="text-xs break-all text-muted">UUID {inv.uuid} · Alumno: {studentName(db.students.find((s) => s.id === inv.studentId))}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <InvoiceActions invoice={inv} />
                  {inv.status === 'vigente' && <Button variant="fantasma" onClick={() => setCancel(inv)}>Cancelar</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={!!payment} onClose={() => setParams({})} title="Emitir factura (demo)">
        {payment && <EmitForm payment={payment} onDone={() => setParams({})} />}
      </Modal>
      <Modal open={picker} onClose={() => setPicker(false)} title="Elige el pago a facturar">
        {uninvoiced.length === 0 ? (
          <EmptyState icon="check" title="Todos los pagos tienen factura" />
        ) : (
          <ul className="divide-y divide-line">
            {uninvoiced.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-heading">{studentName(db.students.find((s) => s.id === p.studentId))}</p>
                  <p className="text-xs text-muted">{db.charges.find((c) => c.id === p.chargeId)?.description} · {formatDate(p.paidAt)} · {METHOD_LABEL[p.method]}</p>
                </div>
                <Button variant="secundario" onClick={() => { setPicker(false); setParams({ pago: p.id }) }}>{formatMoney(p.amount)}</Button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
      <Modal open={!!cancel} onClose={() => setCancel(null)} title="Cancelar factura (demo)">
        {cancel && <CancelForm invoice={cancel} onDone={() => setCancel(null)} />}
      </Modal>
    </>
  )
}

function EmitForm({ payment, onDone }: { payment: Payment; onDone: () => void }) {
  const { db, act } = useApp()
  const student = db.students.find((s) => s.id === payment.studentId)
  const guardians = db.guardians.filter((g) => student?.guardianIds.includes(g.id))
  const charge = db.charges.find((c) => c.id === payment.chargeId)
  const [who, setWho] = useState(guardians[0]?.id ?? 'publico')
  const g = guardians.find((x) => x.id === who)
  const [rfc, setRfc] = useState(g?.rfc ?? RFC_PUBLICO_GENERAL)
  const [nombre, setNombre] = useState(g?.taxName ?? 'PUBLICO EN GENERAL')
  const [cp, setCp] = useState(g?.taxZip ?? db.meta.cfdiConfig.codigoPostal)
  const [regimen, setRegimen] = useState(g?.taxRegime ?? '616')
  const [uso, setUso] = useState('D10')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (payment.invoiceId) return <Notice tone="info">Este pago ya tiene factura.</Notice>

  const pickWho = (v: string) => {
    setWho(v)
    const x = guardians.find((y) => y.id === v)
    setRfc(x?.rfc ?? RFC_PUBLICO_GENERAL)
    setNombre(x?.taxName ?? 'PUBLICO EN GENERAL')
    setCp(x?.taxZip ?? db.meta.cfdiConfig.codigoPostal)
    setRegimen(x?.taxRegime ?? '616')
    setUso(x ? 'D10' : 'S01')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const r = rfc.trim().toUpperCase()
    if (!RFC_RE.test(r)) return setError('El RFC no tiene un formato válido.')
    if (!/^\d{5}$/.test(cp)) return setError('El código postal debe tener 5 dígitos.')
    if (!nombre.trim()) return setError('Escribe el nombre o razón social del receptor.')
    setBusy(true)
    try {
      const invoiceId = uid('fac')
      const inv = await emitInvoice(db, payment, { rfc: r, nombre: nombre.trim(), cp, regimen, uso }, invoiceId)
      await act(
        async (repo) => {
          await repo.insert('invoices', [inv])
          await repo.update('payments', payment.id, { invoiceId })
          await repo.updateMeta({ cfdiConfig: { ...db.meta.cfdiConfig, nextFolio: db.meta.cfdiConfig.nextFolio + 1 } })
        },
        { action: 'Emitió factura demo', detail: `${inv.serie}-${inv.folio} · ${formatMoney(inv.total)} · ${inv.receptorRfc}` },
      )
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo emitir la factura.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3" noValidate>
      <div className="rounded-xl bg-surface-2 p-3 text-sm">
        <p className="font-semibold text-heading">{charge?.description}</p>
        <p className="text-muted">{studentName(student)} · {formatMoney(payment.amount)} · {METHOD_LABEL[payment.method]} · {formatDate(payment.paidAt)}</p>
      </div>
      <Field label="Facturar a">
        {(id) => (
          <Select id={id} value={who} onChange={(e) => pickWho(e.target.value)}>
            {guardians.map((x) => <option key={x.id} value={x.id}>{x.firstName} {x.lastName} ({x.relation})</option>)}
            <option value="publico">Público en general</option>
          </Select>
        )}
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="RFC">{(id) => <Input id={id} value={rfc} maxLength={13} onChange={(e) => setRfc(e.target.value.toUpperCase())} />}</Field>
        <Field label="Código postal fiscal">{(id) => <Input id={id} value={cp} maxLength={5} inputMode="numeric" onChange={(e) => setCp(e.target.value)} />}</Field>
      </div>
      <Field label="Nombre o razón social (como en su constancia fiscal)">{(id) => <Input id={id} value={nombre} onChange={(e) => setNombre(e.target.value)} />}</Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Régimen fiscal">
          {(id) => (
            <Select id={id} value={regimen} onChange={(e) => setRegimen(e.target.value)}>
              {Object.entries(REGIMENES).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Uso de la factura (CFDI)">
          {(id) => (
            <Select id={id} value={uso} onChange={(e) => setUso(e.target.value)}>
              {Object.entries(USOS_CFDI).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}
            </Select>
          )}
        </Field>
      </div>
      <p className="text-xs text-muted">Forma de pago: PUE (pago en una sola exhibición). Las colegiaturas están exentas de IVA. Si el concepto es educativo, se agrega el complemento de instituciones educativas (IEDU) con los datos del alumno.</p>
      {error && <Notice tone="peligro">{error}</Notice>}
      <div className="flex justify-end">
        <Button type="submit" icon="factura" disabled={busy}>{busy ? 'Timbrando (demo)…' : 'Emitir factura demo'}</Button>
      </div>
    </form>
  )
}

function CancelForm({ invoice, onDone }: { invoice: Invoice; onDone: () => void }) {
  const { db, act } = useApp()
  const [motivo, setMotivo] = useState<'01' | '02' | '03' | '04'>('02')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const pac = getPacAdapter(db.meta.cfdiConfig.pacProvider)
      const res = await pac.cancelar({ uuid: invoice.uuid, rfcEmisor: db.meta.cfdiConfig.rfcEmisor, total: invoice.total, motivo })
      await act(
        async (repo) => {
          await repo.update('invoices', invoice.id, { status: 'cancelada', cancelReason: `${motivo} ${MOTIVOS_CANCELACION[motivo]} · ${res.acuse}` })
          await repo.update('payments', invoice.paymentId, { invoiceId: null })
        },
        { action: 'Canceló factura demo', detail: `${invoice.serie}-${invoice.folio} · motivo ${motivo}` },
      )
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cancelar.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3">
      <p>Factura {invoice.serie}-{invoice.folio} por {formatMoney(invoice.total)}. Al cancelarla, el pago queda libre para volver a facturarse.</p>
      <Field label="Motivo de cancelación">
        {(id) => (
          <Select id={id} value={motivo} onChange={(e) => setMotivo(e.target.value as typeof motivo)}>
            {Object.entries(MOTIVOS_CANCELACION).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}
          </Select>
        )}
      </Field>
      {error && <Notice tone="peligro">{error}</Notice>}
      <div className="flex justify-end gap-2">
        <Button variant="secundario" onClick={onDone}>Volver</Button>
        <Button type="submit" variant="peligro" disabled={busy}>{busy ? 'Cancelando…' : 'Cancelar factura'}</Button>
      </div>
      <p className="text-xs text-muted"><Link to="/facturacion/configuracion" className="text-link underline">Ver cómo funciona la cancelación real</Link></p>
    </form>
  )
}
