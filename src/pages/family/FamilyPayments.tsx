import { Badge, Card, EmptyState, LinkButton, PageHeader } from '../../components/ui'
import { formatDate, formatMoney } from '../../lib/format'
import { studentBalance, studentCharges } from '../../lib/finance'
import { groupLabel, studentName, visibleStudents } from '../../lib/scope'
import { useApp } from '../../state/context'

export function FamilyPayments() {
  const { db, session } = useApp()
  const kids = visibleStudents(db, session)
  const reminders = db.reminders.filter((r) => r.guardianId === session.personId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return (
    <>
      <PageHeader title="Pagos" subtitle="Consulta lo que has pagado y lo que falta. El pago se hace en la escuela o por transferencia." />
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
                      <div className="text-right">
                        <p className="font-semibold text-heading">{formatMoney(c.balance)}</p>
                        <Badge tone={c.status === 'vencido' ? 'peligro' : c.status === 'parcial' ? 'aviso' : 'neutro'}>{c.status === 'vencido' ? 'Vencido' : c.status === 'parcial' ? 'Pago parcial' : 'Por vencer'}</Badge>
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
    </>
  )
}
