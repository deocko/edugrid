import { Link } from 'react-router'
import { Badge, Card, DemoBadge, LinkButton, PageHeader, Stat } from '../../components/ui'
import { formatDate, formatMoney, todayISO } from '../../lib/format'
import { chargeView } from '../../lib/finance'
import { LEVEL_LABEL, LEVELS, audienceLabel, levelOfGroup, studentName } from '../../lib/scope'
import { useApp } from '../../state/context'

export function AdminHome() {
  const { db, session } = useApp()
  const active = db.students.filter((s) => s.status === 'activo')
  const today = todayISO()
  const month = today.slice(0, 7)

  const recentDates = [...new Set(db.attendance.map((a) => a.date))].sort().slice(-5)
  const recent = db.attendance.filter((a) => recentDates.includes(a.date))
  const presentRate = recent.length ? Math.round((recent.filter((a) => a.status === 'presente' || a.status === 'retardo').length / recent.length) * 100) : 0

  const views = db.charges.map((c) => chargeView(db, c, today))
  const monthCharges = views.filter((c) => c.dueDate.startsWith(month))
  const expected = monthCharges.reduce((s, c) => s + c.amount, 0)
  const collected = monthCharges.reduce((s, c) => s + c.paid, 0)
  const overdue = views.filter((c) => c.status === 'vencido')
  const overdueTotal = overdue.reduce((s, c) => s + c.balance, 0)
  const debtors = new Set(overdue.map((c) => c.studentId)).size
  const pendingConsent = db.guardians.filter((g) => !g.consentAt && active.some((s) => s.guardianIds.includes(g.id)))

  const byLevel = LEVELS.map((l) => ({ level: l, count: active.filter((s) => levelOfGroup(db, s.groupId) === l).length }))
  const max = Math.max(1, ...byLevel.map((b) => b.count))
  const latest = [...db.announcements].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4)
  const newest = [...active].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3)

  return (
    <>
      <PageHeader
        title={`Hola, ${session.name.split(' ').slice(0, 2).join(' ')}`}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            {db.meta.school.name} <DemoBadge />
          </span>
        }
        actions={
          <>
            <LinkButton to="/admin/alumnos?alta=1" icon="mas">
              Inscribir alumno
            </LinkButton>
            <LinkButton to="/pagos?registrar=1" variant="secundario" icon="pagos">
              Registrar pago
            </LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Alumnos activos" value={active.length} hint={`${db.groups.length} grupos en 5 niveles`} icon="alumnos" tone="info" />
        <Stat label="Asistencia (5 días)" value={`${presentRate}%`} hint="Presentes y retardos" icon="asistencia" tone="exito" />
        <Stat label="Cobrado este mes" value={formatMoney(collected)} hint={`de ${formatMoney(expected)} esperado`} icon="pagos" tone="info" />
        <Stat label="Adeudo vencido" value={formatMoney(overdueTotal)} hint={`${debtors} alumnos con atraso`} icon="alerta" tone="peligro" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Alumnos por nivel" className="lg:col-span-2">
          <ul className="space-y-3">
            {byLevel.map((b) => (
              <li key={b.level} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-3 text-sm">
                <span className="font-semibold text-heading">{LEVEL_LABEL[b.level]}</span>
                <span className="h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${(b.count / max) * 100}%` }} />
                </span>
                <span className="text-right font-bold text-heading">{b.count}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Pendientes">
          <ul className="space-y-3 text-sm">
            <li className="flex items-center justify-between gap-2">
              <span>Consentimientos de tutores sin firmar</span>
              <Badge tone={pendingConsent.length ? 'aviso' : 'exito'}>{pendingConsent.length}</Badge>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span>Cargos vencidos</span>
              <Badge tone={overdue.length ? 'peligro' : 'exito'}>{overdue.length}</Badge>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span>Pagos sin factura</span>
              <Badge tone="info">{db.payments.filter((p) => !p.invoiceId).length}</Badge>
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <LinkButton to="/pagos?vista=adeudos" variant="secundario">
              Ver adeudos
            </LinkButton>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Últimos avisos" action={<Link to="/avisos" className="text-sm font-semibold text-link underline">Ver todos</Link>}>
          <ul className="divide-y divide-line">
            {latest.map((a) => (
              <li key={a.id} className="py-2.5">
                <p className="font-semibold text-heading">{a.title}</p>
                <p className="text-xs text-muted">
                  {formatDate(a.createdAt)} · {audienceLabel(db, a.audience)} · {db.receipts.filter((r) => r.announcementId === a.id).length} lecturas
                </p>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Inscripciones recientes" action={<Link to="/admin/alumnos" className="text-sm font-semibold text-link underline">Ver alumnos</Link>}>
          <ul className="divide-y divide-line">
            {newest.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-2.5">
                <Link to={`/alumnos/${s.id}`} className="font-semibold text-link underline">
                  {studentName(s)}
                </Link>
                <span className="text-xs text-muted">{formatDate(s.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
