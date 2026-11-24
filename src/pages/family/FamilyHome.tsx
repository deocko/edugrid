import { Link } from 'react-router'
import { Avatar, Badge, Button, Card, EmptyState, LinkButton, PageHeader } from '../../components/ui'
import { attendanceSummary } from '../../lib/attendance'
import { formatDate, formatMoney, nowISO, todayISO } from '../../lib/format'
import { studentBalance } from '../../lib/finance'
import { averageFor, groupLabel, isPreschool, levelOfGroup, userKey, visibleAnnouncements, visibleEvents, visibleStudents } from '../../lib/scope'
import { useApp } from '../../state/context'
import { checkinsOfDay } from '../../lib/presence'
import type { Database } from '../../data/types'

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
      <PageHeader title={`Hola, ${session.name.split(' ')[0]}`} subtitle="Aquí ves todo lo de tus hijas e hijos en la escuela." actions={kids.length > 0 ? <><LinkButton to="/familia/qr" icon="qr">Mostrar QR</LinkButton><LinkButton to="/familia/chat" variant="secundario" icon="chat">Chat con maestras</LinkButton></> : undefined} />
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
                  <Avatar name={`${k.firstName} ${k.lastName}`} src={k.photo} size={48} />
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-heading">{k.firstName} {k.lastName}</h2>
                    <p className="text-sm text-muted">{groupLabel(db, k.groupId)}</p>
                  </div>
                </div>
                <TodayLine db={db} studentId={k.id} />
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="flex flex-col rounded-xl bg-surface-2 px-1.5 py-2">
                    <dt className="flex-1 text-xs text-muted">Asistencia</dt>
                    <dd className="mt-1 text-[0.8125rem] font-bold tabular-nums min-[360px]:text-sm min-[400px]:text-base text-heading sm:text-lg">{att.rate}%</dd>
                  </div>
                  <div className="flex flex-col rounded-xl bg-surface-2 px-1.5 py-2">
                    <dt className="flex-1 text-xs text-muted">{isPreschool(level) ? 'Evaluación' : 'Promedio 1er trim.'}</dt>
                    <dd className="mt-1 text-[0.8125rem] font-bold tabular-nums min-[360px]:text-sm min-[400px]:text-base text-heading sm:text-lg">{isPreschool(level) ? 'Ver' : (avg?.toFixed(1) ?? '—')}</dd>
                  </div>
                  <div className="flex flex-col rounded-xl bg-surface-2 px-1.5 py-2">
                    <dt className="flex-1 text-xs text-muted">Saldo</dt>
                    <dd className={`mt-1 text-[0.8125rem] font-bold tabular-nums min-[360px]:text-sm min-[400px]:text-base sm:text-lg ${bal.overdue > 0 ? 'text-danger' : 'text-heading'}`}>{formatMoney(bal.balance)}</dd>
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

/** Una línea con lo de hoy: entrada/salida con QR y la última novedad de su docente. */
function TodayLine({ db, studentId }: { db: Database; studentId: string }) {
  const today = checkinsOfDay(db, studentId)
  const last = db.studentUpdates.filter((u) => u.studentId === studentId && u.at.startsWith(todayISO())).sort((a, b) => b.at.localeCompare(a.at))[0]
  if (today.length === 0 && !last) return <p className="mt-3 text-sm text-muted">Hoy aún no hay registro de entrada.</p>
  return (
    <div className="mt-3 space-y-1 text-sm">
      {today.length > 0 && (
        <p className="flex flex-wrap items-center gap-2">
          <Badge tone={today.at(-1)?.type === 'entrada' ? 'exito' : 'info'}>{today.at(-1)?.type === 'entrada' ? 'En la escuela' : 'Ya salió'}</Badge>
          {today.map((c) => `${c.type === 'entrada' ? 'Entró' : 'Salió'} ${c.at.slice(11, 16)}`).join(' · ')}
        </p>
      )}
      {last && <p className="text-muted"><strong className="text-heading">{last.teacherName}:</strong> {last.text}</p>}
    </div>
  )
}
