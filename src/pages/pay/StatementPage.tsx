import { useEffect, useRef } from 'react'
import { useParams } from 'react-router'
import { AccessDenied } from '../../components/guards'
import { InvoiceActions } from '../../components/InvoiceActions'
import { Badge, Button, Card, DemoBadge, EmptyState, LinkButton, PageHeader, type Tone } from '../../components/ui'
import { formatDate, formatMoney } from '../../lib/format'
import { METHOD_LABEL, STATUS_LABEL, studentBalance, studentCharges, type ChargeStatus } from '../../lib/finance'
import { canSeeStudent, groupLabel, studentName } from '../../lib/scope'
import { useApp } from '../../state/context'

const TONE: Record<ChargeStatus, Tone> = { pagado: 'exito', parcial: 'aviso', vencido: 'peligro', pendiente: 'neutro' }

export function StatementPage() {
  const { id = '' } = useParams()
  const { db, session, log } = useApp()
  const student = db.students.find((s) => s.id === id)
  const allowed = canSeeStudent(db, session, id)
  const logged = useRef('')
  useEffect(() => {
    if (!allowed || !student || logged.current === id) return
    logged.current = id
    void log({ action: 'Consultó estado de cuenta', detail: studentName(student), kind: 'acceso' })
  }, [allowed, student, id, log])

  if (!student || !allowed) return <AccessDenied detail={`Estado de cuenta del alumno ${id}`} />
  const charges = studentCharges(db, id)
  const bal = studentBalance(db, id)
  const isAdmin = session.role === 'admin'

  return (
    <>
      <PageHeader
        title="Estado de cuenta"
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            {studentName(student)} · {groupLabel(db, student.groupId)} · Ciclo 2026-2027 <DemoBadge soloDemo />
          </span>
        }
        actions={
          <>
            {isAdmin && <LinkButton to={`/pagos?registrar=1&alumno=${id}`} icon="pagos">Registrar pago</LinkButton>}
            <Button variant="secundario" onClick={() => window.print()} className="no-print">Imprimir</Button>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card-tint rounded-2xl border p-4 shadow-sm"><p className="text-sm text-muted">Total de cargos</p><p className="text-2xl font-extrabold text-heading">{formatMoney(bal.total)}</p></div>
        <div className="card-tint rounded-2xl border p-4 shadow-sm"><p className="text-sm text-muted">Pagado</p><p className="text-2xl font-extrabold text-success">{formatMoney(bal.paid)}</p></div>
        <div className="card-tint rounded-2xl border p-4 shadow-sm"><p className="text-sm text-muted">Saldo pendiente</p><p className={`text-2xl font-extrabold ${bal.overdue ? 'text-danger' : 'text-heading'}`}>{formatMoney(bal.balance)}</p>{bal.overdue > 0 && <p className="text-sm text-danger">{formatMoney(bal.overdue)} vencido</p>}</div>
      </div>
      <Card title="Movimientos">
        {charges.length === 0 ? (
          <EmptyState icon="pagos" title="Sin cargos registrados" />
        ) : (
          <ul className="divide-y divide-line">
            {charges.map((c) => (
              <li key={c.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-heading">{c.description}</p>
                    <p className="text-sm text-muted">Vence {formatDate(c.dueDate)} · Cargo {formatMoney(c.amount)}</p>
                  </div>
                  <div className="text-right">
                    <Badge tone={TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                    {c.balance > 0 && <p className="mt-1 text-sm font-semibold text-heading">Saldo {formatMoney(c.balance)}</p>}
                  </div>
                </div>
                {c.payments.length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {c.payments.map((p) => {
                      const inv = db.invoices.find((i) => i.id === p.invoiceId)
                      return (
                        <li key={p.id} className="flex flex-col gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm md:flex-row md:items-center md:justify-between">
                          <span>
                            Pago {formatDate(p.paidAt)} · {METHOD_LABEL[p.method]}{p.reference ? ` · ${p.reference}` : ''} · <strong className="text-heading">{formatMoney(p.amount)}</strong>
                          </span>
                          {inv ? (
                            <span className="flex flex-wrap items-center gap-2">
                              <Badge tone={inv.status === 'vigente' ? 'info' : 'peligro'}>Factura {inv.serie}-{inv.folio}{inv.status === 'cancelada' ? ' cancelada' : ''}</Badge>
                              <InvoiceActions invoice={inv} />
                            </span>
                          ) : isAdmin ? (
                            <LinkButton to={`/facturacion?pago=${p.id}`} variant="fantasma" icon="factura">Facturar este pago</LinkButton>
                          ) : (
                            <span className="text-xs text-muted">Sin factura. Solicítala en la escuela.</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="mt-4 text-sm no-print">
        <LinkButton to={isAdmin ? '/pagos' : '/familia/pagos'} variant="fantasma" icon="izquierda">Volver a pagos</LinkButton>
      </p>
    </>
  )
}
