import { Link } from 'react-router'
import { Avatar, Badge, Button, Card, EmptyState, LinkButton, PageHeader } from '../../components/ui'
import { attendanceSummary } from '../../lib/attendance'
import { formatDate, formatMoney, nowISO, todayISO } from '../../lib/format'
import { studentBalance } from '../../lib/finance'
import { averageFor, groupLabel, isPreschool, levelOfGroup, userKey, visibleAnnouncements, visibleEvents, visibleStudents } from '../../lib/scope'
import { useApp } from '../../state/context'

export function FamilyHome() {
  const { db, session, act } = useApp()
  const kids = visibleStudents(db, session)
  const me = db.guardians.find((g) => g.id === session.personId)
  const unread = visibleAnnouncements(db, session).filter((a) => !db.receipts.some((r) => r.announcementId === a.id && r.userKey === userKey(session)))
  const upcoming = visibleEvents(db, session).filter((e) => (e.endDate ?? e.date) >= todayISO()).slice(0, 4)

  const consent = async () => {
    await act((repo) => repo.update('guardians', session.personId, { consentAt: nowISO() }), { action: 'Otorgó consentimiento', detail: 'Aviso de privacidad aceptado desde el portal' })
  }

  return (
    <>
      <PageHeader title={`Hola, ${session.name.split(' ')[0]}`} subtitle="Aquí ves todo lo de tus hijas e hijos en la escuela." />
      {me && !me.consentAt && (
        <Card className="mb-4 border-warning/60">
          <p className="font-semibold text-heading">Necesitamos tu consentimiento</p>
          <p className="mt-1 text-sm">
            Para cuidar los datos de tus hijos, lee el{' '}
            <Link to="/privacidad" className="font-semibold text-link underline">aviso de privacidad</Link> y confirma que estás de acuerdo.
          </p>
          <Button className="mt-3" icon="check" onClick={() => void consent()}>Leí y acepto el aviso de privacidad</Button>
        </Card>
      )}
      {kids.length === 0 ? (
        <EmptyState icon="hijo" title="No hay alumnos vinculados a tu cuenta">Si crees que es un error, comunícate con la escuela.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {kids.map((k) => {
            const level = levelOfGroup(db, k.groupId)
            const att = attendanceSummary(db, k.id)
            const avg = averageFor(db, k.id, 'p1')
            const bal = studentBalance(db, k.id)
            return (
              <Card key={k.id} as="article">
                <div className="flex items-center gap-3">
                  <Avatar name={`${k.firstName} ${k.lastName}`} size={48} />
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-heading">{k.firstName} {k.lastName}</h2>
                    <p className="text-sm text-muted">{groupLabel(db, k.groupId)}</p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-surface-2 p-2">
                    <dt className="text-xs text-muted">Asistencia</dt>
                    <dd className="text-base font-bold tabular-nums text-heading sm:text-lg">{att.rate}%</dd>
                  </div>
                  <div className="rounded-xl bg-surface-2 p-2">
                    <dt className="text-xs text-muted">{isPreschool(level) ? 'Evaluación' : 'Promedio 1er trim.'}</dt>
                    <dd className="text-base font-bold tabular-nums text-heading sm:text-lg">{isPreschool(level) ? 'Ver' : (avg?.toFixed(1) ?? '—')}</dd>
                  </div>
                  <div className="rounded-xl bg-surface-2 p-2">
                    <dt className="text-xs text-muted">Saldo</dt>
                    <dd className={`text-base font-bold tabular-nums sm:text-lg ${bal.overdue > 0 ? 'text-danger' : 'text-heading'}`}>{formatMoney(bal.balance)}</dd>
                  </div>
                </dl>
                {bal.overdue > 0 && <p className="mt-2 text-sm font-semibold text-danger">Tienes {formatMoney(bal.overdue)} vencido.</p>}
                <LinkButton to={`/familia/hijo/${k.id}`} variant="secundario" icon="ojo" className="mt-4 w-full">
                  Ver todo de {k.firstName}
                </LinkButton>
              </Card>
            )
          })}
        </div>
      )}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Avisos sin leer" action={<Link to="/avisos" className="-mr-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-link no-underline hover:bg-info-bg">Ir a avisos</Link>}>
          {unread.length === 0 ? (
            <p className="text-sm text-muted">Estás al día. No tienes avisos pendientes.</p>
          ) : (
            <ul className="divide-y divide-line">
              {unread.slice(0, 4).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="font-semibold text-heading">{a.title}</span>
                  {a.requiresAck && <Badge tone="aviso">Confirma lectura</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Próximas fechas" action={<Link to="/familia/calendario" className="-mr-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-link no-underline hover:bg-info-bg">Ver calendario</Link>}>
          <ul className="divide-y divide-line">
            {upcoming.map((e) => (
              <li key={e.id} className="py-2">
                <p className="font-semibold text-heading">{e.title}</p>
                <p className="text-xs text-muted">{formatDate(e.date)}{e.endDate ? ` al ${formatDate(e.endDate)}` : ''}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
