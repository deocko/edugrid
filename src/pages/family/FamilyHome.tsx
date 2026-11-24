import { useState } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { Avatar, Badge, Button, Card, EmptyState, LinkButton, PageHeader } from '../../components/ui'
import { ATT_LABEL, ATT_TONE, attendanceOfDay, attendanceSummary } from '../../lib/attendance'
import { formatDate, formatMoney, nowISO, todayISO } from '../../lib/format'
import { studentBalance } from '../../lib/finance'
import { LEVEL_LABEL, averageFor, formatAverage, groupLabel, isPreschool, levelOfGroup, userKey, visibleAnnouncements, visibleEvents, visibleStudents } from '../../lib/scope'
import { useApp } from '../../state/context'
import { checkinsOfDay } from '../../lib/presence'
import type { Database } from '../../data/types'

export function FamilyHome() {
  const { db, session, act } = useApp()
  const kids = visibleStudents(db, session)
  // Cada hijo es un expediente contraído; al tocarlo se abre con lo de hoy y sus datos.
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const toggle = (id: string) => setOpen((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
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
        <ul className="space-y-3" aria-label="Expedientes de tus hijos">
          {kids.map((k, idx) => {
            const level = levelOfGroup(db, k.groupId)
            const att = attendanceSummary(db, k.id)
            const avg = averageFor(db, k.id, 'p1')
            const bal = studentBalance(db, k.id)
            const isOpen = open.has(k.id)
            const panel = `expediente-${k.id}`
            return (
              <li key={k.id} className="relative pt-4">
                {/* Pestaña de folder: el expediente de cada hijo */}
                <span aria-hidden="true" className={`${FOLDER_COLORS[idx % FOLDER_COLORS.length]} absolute top-0 left-4 inline-flex h-5 items-center gap-1 rounded-t-xl border border-b-0 border-[var(--s)] bg-[var(--s-bg)] px-3 text-[11px] font-semibold text-[var(--s-ink)]`}>
                  <Icon name="libro" size={12} /> Expediente
                </span>
                <article className={`${FOLDER_COLORS[idx % FOLDER_COLORS.length]} relative rounded-2xl border border-l-4 border-l-[var(--s)] bg-surface shadow-sm transition ${isOpen ? 'border-[var(--s)] shadow-md' : 'border-line hover:border-[var(--s)]'}`}>
                  <h2 className="m-0">
                    <button type="button" onClick={() => toggle(k.id)} aria-expanded={isOpen} aria-controls={panel} className="flex w-full items-center gap-3 rounded-2xl p-4 text-left sm:p-5">
                      <Avatar name={`${k.firstName} ${k.lastName}`} src={k.photo} size={56} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg font-bold text-heading">{k.firstName} {k.lastName}</span>
                        <span className="block text-sm text-muted">{groupLabel(db, k.groupId)}</span>
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          <Badge tone="info">{level ? LEVEL_LABEL[level] : 'Sin nivel'}</Badge>
                          <Badge>Matrícula {k.enrollmentId}</Badge>
                        </span>
                      </span>
                      <span className={`shrink-0 rounded-full bg-surface-2 p-2 text-muted transition ${isOpen ? 'rotate-90 text-link' : ''}`}>
                        <Icon name="derecha" size={20} />
                      </span>
                      <span className="sr-only">{isOpen ? 'Contraer expediente' : 'Abrir expediente'}</span>
                    </button>
                  </h2>
                  {isOpen && (
                    <div id={panel} className="border-t border-line px-4 pb-4 sm:px-5 sm:pb-5">
                      <TodayLine db={db} studentId={k.id} />
                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <Link to={`/familia/hijo/${k.id}?vista=asistencia`} className="group flex flex-col rounded-xl bg-surface-2 px-1.5 py-2 no-underline ring-1 ring-transparent transition hover:ring-primary focus-visible:ring-primary">
                          <span className="block flex-1 text-xs text-muted">Asistencia</span>
                          <span className="block mt-1 text-[0.8125rem] font-bold tabular-nums min-[360px]:text-sm min-[400px]:text-base text-heading sm:text-lg">{att.rate}%</span>
                          <span aria-hidden="true" className="mx-auto mt-1 block h-1 w-4/5 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-success" style={{ width: `${att.rate}%` }} /></span>
                        </Link>
                        <Link to={`/familia/hijo/${k.id}?vista=calificaciones`} className="group flex flex-col rounded-xl bg-surface-2 px-1.5 py-2 no-underline ring-1 ring-transparent transition hover:ring-primary focus-visible:ring-primary">
                          <span className="block flex-1 text-xs text-muted">{isPreschool(level) ? 'Evaluación' : 'Promedio 1er trim.'}</span>
                          <span className="block mt-1 text-[0.8125rem] font-bold tabular-nums min-[360px]:text-sm min-[400px]:text-base text-heading sm:text-lg">{isPreschool(level) ? 'Ver' : formatAverage(avg)}</span>
                        </Link>
                        <Link to={`/familia/hijo/${k.id}?vista=pagos`} className="group flex flex-col rounded-xl bg-surface-2 px-1.5 py-2 no-underline ring-1 ring-transparent transition hover:ring-primary focus-visible:ring-primary">
                          <span className="block flex-1 text-xs text-muted">Saldo</span>
                          <span className={`block mt-1 text-[0.8125rem] font-bold tabular-nums min-[360px]:text-sm min-[400px]:text-base sm:text-lg ${bal.overdue > 0 ? 'text-danger' : 'text-heading'}`}>{formatMoney(bal.balance)}</span>
                        </Link>
                      </div>
                      {bal.overdue > 0 && <p className="mt-2 text-sm font-semibold text-danger">Tienes {formatMoney(bal.overdue)} vencido.</p>}
                      <LinkButton to={`/familia/hijo/${k.id}`} variant="secundario" icon="ojo" className="mt-4 w-full">
                        Ver todo de {k.firstName}
                      </LinkButton>
                    </div>
                  )}
                </article>
              </li>
            )
          })}
        </ul>
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

/** Color pastel de la pestaña de cada expediente (misma paleta accesible de las materias). */
const FOLDER_COLORS = ['subj-azul', 'subj-rosa', 'subj-verde', 'subj-morado', 'subj-naranja']

/** Una línea con lo de hoy: entrada/salida con QR y la última novedad de su docente. */
function TodayLine({ db, studentId }: { db: Database; studentId: string }) {
  const today = checkinsOfDay(db, studentId)
  const last = db.studentUpdates.filter((u) => u.studentId === studentId && u.at.startsWith(todayISO())).sort((a, b) => b.at.localeCompare(a.at))[0]
  const att = attendanceOfDay(db, studentId, todayISO())
  if (today.length === 0 && !last && !att) return <p className="mt-3 text-sm text-muted">Asistencia de hoy: aún sin registro de entrada.</p>
  return (
    <div className="mt-3 space-y-1 text-sm">
      <p className="flex flex-wrap items-center gap-2">
        <span className="text-muted">Asistencia de hoy:</span>
        {att ? <Badge tone={ATT_TONE[att.status]}>{ATT_LABEL[att.status]}</Badge> : <span className="text-muted">aún sin registro</span>}
      </p>
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
