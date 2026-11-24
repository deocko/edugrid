import { useNavigate } from 'react-router'
import { Icon, type IconName } from '../../components/Icon'
import { Button, Card, EmptyState, PageHeader } from '../../components/ui'
import type { AppNotification } from '../../data/types'
import { formatDateTime, nowISO } from '../../lib/format'
import { userKey } from '../../lib/scope'
import { useApp } from '../../state/context'

const ICON: Record<AppNotification['kind'], IconName> = { entrada: 'qr', salida: 'qr', estatus: 'camara', chat: 'chat', aviso: 'avisos' }

/** Notificaciones de la cuenta: entradas y salidas, novedades, mensajes del chat. */
export function NotificationsPage() {
  const { db, session, act } = useApp()
  const navigate = useNavigate()
  const me = userKey(session)
  const list = db.notifications.filter((n) => n.userKey === me).sort((a, b) => b.at.localeCompare(a.at))
  const unread = list.filter((n) => !n.readAt)

  const openOne = async (n: AppNotification) => {
    if (!n.readAt) await act((repo) => repo.update('notifications', n.id, { readAt: nowISO() }))
    navigate(n.link)
  }
  const readAll = async () => {
    const at = nowISO()
    await act(async (repo) => { for (const n of unread) await repo.update('notifications', n.id, { readAt: at }) })
  }

  return (
    <>
      <PageHeader title="Notificaciones" subtitle="Lo que pasa con tus hijos en la escuela, al momento." actions={unread.length > 0 ? <Button variant="secundario" icon="check" onClick={() => void readAll()}>Marcar todas como leídas</Button> : undefined} />
      <Card>
        {list.length === 0 ? (
          <EmptyState icon="campana" title="No tienes notificaciones" />
        ) : (
          <ul className="-mx-2 space-y-1">
            {list.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => void openOne(n)} className={`flex w-full items-start gap-3 rounded-xl p-3 text-left hover:bg-surface-2 ${n.readAt ? '' : 'bg-info-bg'}`}>
                  <span className={`mt-0.5 rounded-lg p-2 ${n.kind === 'entrada' ? 'bg-success-bg text-success' : 'bg-surface-2 text-link'}`}><Icon name={ICON[n.kind]} size={18} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-semibold text-heading">
                      {n.title}
                      {!n.readAt && <span className="size-2 rounded-full bg-primary" aria-label="Sin leer" />}
                    </span>
                    <span className="block text-sm">{n.body}</span>
                    <span className="block text-xs text-muted">{formatDateTime(n.at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
