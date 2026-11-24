import { useState } from 'react'
import { Badge, Button, Card, EmptyState, LinkButton, Modal, Notice, PageHeader, Select } from '../../components/ui'
import { VirtualCard } from '../../components/VirtualCard'
import type { Payment } from '../../data/types'
import { BRAND_LABEL, formatExpiry, isExpired } from '../../lib/cards'
import { nowISO, todayISO, uid } from '../../lib/format'
import { formatDate, formatMoney } from '../../lib/format'
import { studentBalance, studentCharges, type ChargeView } from '../../lib/finance'
import { groupLabel, studentName, visibleStudents } from '../../lib/scope'
import { useApp } from '../../state/context'

export function FamilyPayments() {
  const { db, session } = useApp()
  const kids = visibleStudents(db, session)
  const [paying, setPaying] = useState<ChargeView | null>(null)
  const [paid, setPaid] = useState<Payment | null>(null)
  const hasCards = db.cards.some((c) => c.guardianId === session.personId)
  const reminders = db.reminders.filter((r) => r.guardianId === session.personId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return (
    <>
      <PageHeader title="Pagos" subtitle="Consulta lo que falta y paga con tu tarjeta, por transferencia o en la escuela." />
      {paid && (
        <div className="mb-4" role="status">
          <Notice tone="exito" icon="check">
            Pago aplicado: {formatMoney(paid.amount)} con referencia {paid.reference}. Ya aparece en el estado de cuenta.
          </Notice>
        </div>
      )}
      {!hasCards && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm text-ink">Guarda una tarjeta para pagar desde aquí en un paso.</p>
          <LinkButton to="/familia/tarjetas" icon="tarjeta">Agregar tarjeta</LinkButton>
        </div>
      )}
      {reminders.length > 0 && (
        <Card title="Recordatorios de la escuela" className="mb-4">
          <ul className="divide-y divide-line">
            {reminders.map((r) => (
              <li key={r.id} className="py-2 text-sm">
                <p className="text-heading">{r.message}</p>
                <p className="text-xs text-muted">{formatDate(r.createdAt)}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {kids.length === 0 && <EmptyState icon="pagos" title="No hay alumnos vinculados" />}
      <div className="grid gap-4 lg:grid-cols-2">
        {kids.map((k) => {
          const bal = studentBalance(db, k.id)
          const pending = studentCharges(db, k.id).filter((c) => c.balance > 0)
          return (
            <Card key={k.id} title={studentName(k)} action={<span className="text-sm text-muted">{groupLabel(db, k.groupId)}</span>}>
              <p className="text-sm text-muted">Por pagar</p>
              <p className={`text-2xl font-extrabold ${bal.overdue ? 'text-danger' : 'text-heading'}`}>{formatMoney(bal.balance)}</p>
              {pending.length === 0 ? (
                <p className="mt-3 text-sm font-semibold text-success">Estás al corriente. ¡Gracias!</p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {pending.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="font-semibold text-heading">{c.description}</p>
                        <p className="text-xs text-muted">Vence {formatDate(c.dueDate)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-semibold text-heading">{formatMoney(c.balance)}</p>
                          <Badge tone={c.status === 'vencido' ? 'peligro' : c.status === 'parcial' ? 'aviso' : 'neutro'}>{c.status === 'vencido' ? 'Vencido' : c.status === 'parcial' ? 'Pago parcial' : 'Por vencer'}</Badge>
                        </div>
                        {hasCards && (
                          <Button icon="tarjeta" onClick={() => { setPaid(null); setPaying(c) }} aria-label={`Pagar ${c.description} de ${k.firstName} con tarjeta`}>
                            Pagar
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <LinkButton to={`/pagos/estado/${k.id}`} variant="secundario" className="mt-4" icon="factura">Estado de cuenta y facturas</LinkButton>
            </Card>
          )
        })}
      </div>
      <Modal open={!!paying} onClose={() => setPaying(null)} title="Pagar con tarjeta">
        {paying && <PayWithCard charge={paying} onDone={(p) => { setPaying(null); setPaid(p) }} />}
      </Modal>
    </>
  )
}

function PayWithCard({ charge, onDone }: { charge: ChargeView; onDone: (p: Payment) => void }) {
  const { db, session, act } = useApp()
  const cards = db.cards.filter((c) => c.guardianId === session.personId && !isExpired(c.expMonth, c.expYear, todayISO()))
  const [cardId, setCardId] = useState(cards.find((c) => c.isDefault)?.id ?? cards[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const card = cards.find((c) => c.id === cardId)
  const student = db.students.find((s) => s.id === charge.studentId)
  const pay = async () => {
    if (!card) return
    setBusy(true)
    const n = db.payments.filter((p) => p.reference.startsWith('DEMO-TAR-')).length + 1
    const p: Payment = { id: uid('pg'), chargeId: charge.id, studentId: charge.studentId, amount: charge.balance, method: 'tarjeta', paidAt: nowISO().slice(0, 10), reference: `DEMO-TAR-${String(n).padStart(4, '0')}`, registeredBy: session.personId, invoiceId: null }
    await act((repo) => repo.insert('payments', [p]), { action: 'Pagó con tarjeta', detail: `${student ? studentName(student) : ''} · ${charge.description} · ${formatMoney(p.amount)} · ${BRAND_LABEL[card.brand]} ${card.last4}` })
    onDone(p)
  }
  if (cards.length === 0) return <Notice tone="aviso">No tienes tarjetas vigentes. <LinkButton to="/familia/tarjetas" variant="fantasma">Agregar tarjeta</LinkButton></Notice>
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-surface-2 p-4">
        <p className="text-sm text-muted">{student ? studentName(student) : ''}</p>
        <p className="font-semibold text-heading">{charge.description}</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums text-heading">{formatMoney(charge.balance)}</p>
      </div>
      {cards.length > 1 && (
        <label className="block text-sm font-semibold text-heading">
          Tarjeta
          <Select className="mt-1" value={cardId} onChange={(e) => setCardId(e.target.value)}>
            {cards.map((c) => <option key={c.id} value={c.id}>{BRAND_LABEL[c.brand]} terminación {c.last4}</option>)}
          </Select>
        </label>
      )}
      {card && (
        <div className="flex justify-center">
          <VirtualCard brand={card.brand} last4={card.last4} holder={card.holder} expiry={formatExpiry(card.expMonth, card.expYear)} flipped={false} schoolName={db.meta.school.shortName} />
        </div>
      )}
      <p className="text-xs text-muted">Pago de demostración: no se hace ningún cargo real. En producción el cobro lo procesa una pasarela certificada.</p>
      <div className="flex justify-end">
        <Button icon="candado" onClick={() => void pay()} disabled={busy || !card}>{busy ? 'Procesando…' : `Pagar ${formatMoney(charge.balance)}`}</Button>
      </div>
    </div>
  )
}
