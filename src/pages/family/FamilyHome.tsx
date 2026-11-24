import { useState } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { Avatar, Badge, Button, Card, EmptyState, LinkButton, PageHeader } from '../../components/ui'
import { ATT_LABEL, attendanceOfDay, attendanceSummary } from '../../lib/attendance'
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
              <li key={k.id}>
                <article className={`${FOLDER_COLORS[idx % FOLDER_COLORS.length]} relative overflow-hidden rounded-3xl border border-line border-l-[6px] border-l-[var(--s)] bg-surface shadow-sm transition ${isOpen ? 'shadow-md' : 'hover:shadow-md'}`}>
                  <h2 className="m-0">
                    <button type="button" onClick={() => toggle(k.id)} aria-expanded={isOpen} aria-controls={panel} className="flex w-full items-center gap-3 rounded-3xl p-4 text-left sm:gap-4 sm:p-5">
                      <Avatar name={`${k.firstName} ${k.lastName}`} src={k.photo} size={64} />
                      <span aria-hidden="true" className="hidden h-14 w-px shrink-0 bg-line min-[400px]:block" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg leading-tight font-extrabold text-heading sm:text-xl">{k.firstName} {k.lastName}</span>
                        <span className="mt-0.5 block text-sm text-muted">{groupLabel(db, k.groupId)}</span>
                        <span className="mt-1.5 flex flex-wrap gap-1.5">
                          <Badge tone="info">{level ? LEVEL_LABEL[level] : 'Sin nivel'}</Badge>
                          <Badge>Matrícula: {k.enrollmentId}</Badge>
                        </span>
                      </span>
                      <span className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-heading shadow-sm transition ${isOpen ? 'rotate-180 text-link' : ''}`}>
                        <Icon name="abajo" size={22} />
                      </span>
                      <span className="sr-only">{isOpen ? 'Contraer expediente' : 'Abrir expediente'}</span>
                    </button>
                  </h2>
                  {isOpen && (
                    <div id={panel} className="mx-4 space-y-3 border-t border-line pt-4 pb-4 sm:mx-5 sm:pb-5">
                      <TodayAttendance db={db} studentId={k.id} />
                      <LastNote db={db} studentId={k.id} />
                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        <Link to={`/familia/hijo/${k.id}?vista=asistencia`} className="subj-verde flex flex-col items-center rounded-2xl bg-[var(--s-bg)] px-1.5 py-3 text-center no-underline ring-1 ring-transparent transition hover:ring-[var(--s)] focus-visible:ring-[var(--s)]">
                          <Icon name="asistencia" size={24} className="text-[var(--s-ink)]" />
                          <span className="mt-1 text-xl font-extrabold tabular-nums text-heading min-[400px]:text-2xl">{att.rate}%</span>
                          <span className="text-xs text-heading min-[400px]:text-sm">Asistencia</span>
                          <span aria-hidden="true" className="mt-1.5 block h-1.5 w-4/5 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-success" style={{ width: `${att.rate}%` }} /></span>
                        </Link>
                        <Link to={`/familia/hijo/${k.id}?vista=calificaciones`} className="subj-azul flex flex-col items-center rounded-2xl bg-[var(--s-bg)] px-1.5 py-3 text-center no-underline ring-1 ring-transparent transition hover:ring-[var(--s)] focus-visible:ring-[var(--s)]">
                          <Icon name="docente" size={24} className="text-[var(--s-ink)]" />
                          <span className="mt-1 text-xl font-extrabold tabular-nums text-heading min-[400px]:text-2xl">{isPreschool(level) ? 'Ver' : formatAverage(avg)}</span>
                          <span className="text-xs text-heading min-[400px]:text-sm">{isPreschool(level) ? 'Evaluación' : 'Promedio'}</span>
                        </Link>
                        <Link to={`/familia/hijo/${k.id}?vista=pagos`} className="subj-ambar flex flex-col items-center rounded-2xl bg-[var(--s-bg)] px-1.5 py-3 text-center no-underline ring-1 ring-transparent transition hover:ring-[var(--s)] focus-visible:ring-[var(--s)]">
                          <Icon name="cartera" size={24} className="text-[var(--s-ink)]" />
                          <span className={`mt-1 text-base font-extrabold tabular-nums min-[360px]:text-lg min-[400px]:text-xl ${bal.overdue > 0 ? 'text-danger' : 'text-heading'}`}>{formatMoney(bal.balance).replace(/\.00$/, '')}</span>
                          <span className="text-xs text-heading min-[400px]:text-sm">Saldo</span>
                        </Link>
                      </div>
                      {bal.overdue > 0 && <p className="text-sm font-semibold text-danger">Tienes {formatMoney(bal.overdue)} vencido.</p>}
                      <Link to={`/familia/hijo/${k.id}`} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-primary px-4 font-bold text-link no-underline transition hover:bg-info-bg">
                        <Icon name="ojo" size={22} />
                        <span>Ver expediente de {k.firstName}</span>
                        <Icon name="flecha" size={20} />
                      </Link>
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

/** Color de la franja de cada expediente (misma paleta accesible de las materias). */
const FOLDER_COLORS = ['subj-azul', 'subj-rosa', 'subj-verde', 'subj-morado', 'subj-naranja']

/** Asistencia de hoy: estado del día y horas de entrada/salida con QR. */
function TodayAttendance({ db, studentId }: { db: Database; studentId: string }) {
  const today = checkinsOfDay(db, studentId)
  const att = attendanceOfDay(db, studentId, todayISO())
  const entry = today.find((c) => c.type === 'entrada')
  const exit = today.findLast((c) => c.type === 'salida')
  const times = [entry && `Entrada registrada · ${entry.at.slice(11, 16)} h`, exit && `Salida · ${exit.at.slice(11, 16)} h`].filter(Boolean).join(' · ')
  return (
    <div className="flex items-center gap-3">
      <span className="subj-verde inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--s-bg)] text-[var(--s-ink)]">
        <Icon name="asistencia" size={24} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-heading">Asistencia de hoy<span className="sr-only">:</span></p>
        <p className="text-sm text-muted">{times || 'Aún sin registro de entrada'}</p>
      </div>
      {att ? (
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold ${PILL[att.status]}`}>
          {att.status === 'presente' && <Icon name="check" size={16} />}
          {ATT_LABEL[att.status]}
        </span>
      ) : (
        <Badge>Sin registro</Badge>
      )}
    </div>
  )
}

const PILL = { presente: 'bg-success text-surface', retardo: 'bg-warning-bg text-warning', falta: 'bg-danger text-surface', justificada: 'bg-info-bg text-link' } as const

/** Última observación que escribió su docente (la más reciente, de cualquier día). */
function LastNote({ db, studentId }: { db: Database; studentId: string }) {
  const last = db.studentUpdates.filter((u) => u.studentId === studentId).sort((a, b) => b.at.localeCompare(a.at))[0]
  return (
    <div className="flex gap-3 rounded-2xl bg-surface-2 p-3 sm:p-4">
      <span className="subj-azul inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--s-bg)] text-[var(--s-ink)]">
        <Icon name="observacion" size={24} />
      </span>
      <div className="min-w-0 flex-1 border-l border-line pl-3">
        <p className="font-bold text-heading">Última observación docente</p>
        {last ? (
          <>
            <p className="mt-0.5 text-sm">{last.text}</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-heading">
              <Icon name="persona" size={16} className="text-muted" />
              {last.teacherName}
              {!last.at.startsWith(todayISO()) && <span className="font-normal text-muted">· {formatDate(last.at.slice(0, 10))}</span>}
            </p>
          </>
        ) : (
          <p className="mt-0.5 text-sm text-muted">Todavía no hay observaciones.</p>
        )}
      </div>
    </div>
  )
}
