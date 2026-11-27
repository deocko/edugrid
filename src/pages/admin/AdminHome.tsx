import { Link, useLocation } from 'react-router'
import { BannerPrueba } from '../cuenta/PruebaTerminada'
import { ReporteImportacion, type Reporte } from '../../components/ImportarExcel'
import type { TipoImportacion } from '../../lib/importar'
import { Badge, Card, DemoBadge, LinkButton, PageHeader, Stat } from '../../components/ui'
import { formatDate, formatMoney, todayISO, plural } from '../../lib/format'
import { chargeView } from '../../lib/finance'
import { LEVEL_LABEL, audienceLabel, levelOfGroup, schoolLevels, studentName } from '../../lib/scope'
import { useApp } from '../../state/context'

export function AdminHome() {
  const { db, session } = useApp()
  const importacion = (useLocation().state as { importacion?: { tipo: TipoImportacion; reporte: Reporte } } | null)?.importacion
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

  // Solo los niveles que atiende la escuela (una escuela solo de primaria ve solo Primaria).
  const levels = schoolLevels(db)
  const ciclo = db.cycles.find((c) => c.active)
  const groupsCount = db.groups.filter((g) => (!ciclo || g.cycleId === ciclo.id) && levels.includes(levelOfGroup(db, g.id)!)).length
  const byLevel = levels.map((l) => ({ level: l, count: active.filter((s) => levelOfGroup(db, s.groupId) === l).length }))
  const max = Math.max(1, ...byLevel.map((b) => b.count))
  const latest = [...db.announcements].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4)
  const newest = [...active].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3)

  return (
    <>
      <PageHeader
        title={`Hola, ${session.name.split(' ').slice(0, 2).join(' ')}`}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            {db.meta.school.name} <DemoBadge soloDemo />
          </span>
        }
        actions={
          <>
            <LinkButton to="/admin/entradas" icon="qr">
              Escanear entradas
            </LinkButton>
            <LinkButton to="/admin/alumnos?alta=1" variant="secundario" icon="mas">
              Inscribir alumno
            </LinkButton>
            <LinkButton to="/pagos?registrar=1" variant="secundario" icon="pagos">
              Registrar pago
            </LinkButton>
          </>
        }
      />

      <BannerPrueba />
      {importacion && (
        <Card title="Datos cargados desde Excel" className="mb-4">
          <ReporteImportacion tipo={importacion.tipo} reporte={importacion.reporte} />
        </Card>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Alumnos activos" value={active.length} hint={`${plural(groupsCount, 'grupo', 'grupos')} en ${levels.length === 1 ? LEVEL_LABEL[levels[0]!] : plural(levels.length, 'nivel', 'niveles')}`} icon="alumnos" tone="info" to="/admin/alumnos" action="Ver alumnos" />
        <Stat label="Asistencia (5 días)" value={`${presentRate}%`} hint="Presentes y retardos" icon="asistencia" tone="exito" progress={presentRate / 100} to="/docente/asistencia" action="Ver listas" />
        <Stat label="Cobrado este mes" value={formatMoney(collected)} hint={`de ${formatMoney(expected)} esperado`} icon="pagos" tone="info" progress={expected ? collected / expected : 0} to="/pagos?vista=cargos" action="Ver cargos" />
        <Stat label="Adeudo vencido" value={formatMoney(overdueTotal)} hint={`${plural(debtors, 'alumno', 'alumnos')} con atraso`} icon="alerta" tone="peligro" to="/pagos" action="Cobrar" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Alumnos por nivel" className="lg:col-span-2">
          {active.length === 0 && <p className="mb-3 text-sm text-muted">Aún no hay alumnos inscritos. Inscríbelos o impórtalos desde Excel en Alumnos.</p>}
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
        <Card title="Últimos avisos" action={<Link to="/avisos" className="-mr-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-link no-underline hover:bg-info-bg">Ver todos</Link>}>
          {latest.length === 0 && <p className="py-2 text-sm text-muted">Aún no hay avisos publicados. Publícalos desde Avisos.</p>}
          <ul className="divide-y divide-line">
            {latest.map((a) => (
              <li key={a.id} className="py-2.5">
                <p className="font-semibold text-heading">{a.title}</p>
                <p className="text-xs text-muted">
                  {formatDate(a.createdAt)} · {audienceLabel(db, a.audience)} · {plural(db.receipts.filter((r) => r.announcementId === a.id).length, 'lectura', 'lecturas')}
                </p>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Inscripciones recientes" action={<Link to="/admin/alumnos" className="-mr-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-link no-underline hover:bg-info-bg">Ver alumnos</Link>}>
          {newest.length === 0 && <p className="py-2 text-sm text-muted">Aún no hay inscripciones en este ciclo.</p>}
          <ul className="divide-y divide-line">
            {newest.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-2.5">
                <Link to={`/alumnos/${s.id}`} className="font-semibold text-link no-underline hover:underline">
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
