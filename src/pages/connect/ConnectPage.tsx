import { useState, type FormEvent } from 'react'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Notice, PageHeader, Select, Tabs, Switch, Textarea } from '../../components/ui'
import type { Announcement, AppNotification, Audience, Database, Level } from '../../data/types'
import { formatDateTime, nowISO, uid, plural } from '../../lib/format'
import { LEVEL_LABEL, audienceLabel, groupLabel, familiesOf, levelOfGroup, schoolLevels, teacherGroupIds, type Family, userKey, visibleAnnouncements } from '../../lib/scope'
import { useApp } from '../../state/context'

type View = 'aviso' | 'mensaje'

/**
 * Familias que deben recibir un aviso, según su audiencia. Una familia es un hogar: los hermanos
 * comparten tutores, así que se cuentan una sola vez (no por tutor ni por alumno).
 */
const recipientsOf = (db: Database, a: Announcement) => {
  const students = db.students.filter((s) => {
    if (s.status !== 'activo') return false
    if (a.audience.type === 'escuela') return true
    if (a.audience.type === 'grupo') return s.groupId === a.audience.groupId
    const lvl = levelOfGroup(db, s.groupId)
    return lvl === a.audience.level || (a.audience.level === 'kinder' && lvl === 'maternal')
  })
  return familiesOf(db, students)
}

/** Familias que ya leyeron: basta con que uno de sus tutores lo haya marcado. */
const familiesRead = (db: Database, a: Announcement, families: Family[]) => {
  const keys = new Set(db.receipts.filter((r) => r.announcementId === a.id && r.userKey.startsWith('familia:')).map((r) => r.userKey.slice(8)))
  return families.filter((f) => f.guardians.some((g) => keys.has(g.id)))
}

export function ConnectPage() {
  const { db, session, act } = useApp()
  const canWrite = session.role === 'admin' || session.role === 'docente'
  const [view, setView] = useState<View>(session.role === 'docente' ? 'mensaje' : 'aviso')
  const [composer, setComposer] = useState(false)
  const [detail, setDetail] = useState<Announcement | null>(null)
  const all = visibleAnnouncements(db, session)
  const list = all.filter((a) => a.kind === view)
  const me = userKey(session)
  const isRead = (a: Announcement) => db.receipts.some((r) => r.announcementId === a.id && r.userKey === me)

  const acknowledge = async (a: Announcement) => {
    if (isRead(a)) return
    const now = nowISO()
    // Las notificaciones de la campana sobre este aviso también se dan por leídas, para que los contadores bajen al momento.
    const related = db.notifications.filter((n) => n.userKey === me && !n.readAt && n.kind === 'aviso' && n.link.includes(a.id))
    await act(
      async (repo) => {
        await repo.insert('receipts', [{ id: uid('rr'), announcementId: a.id, userKey: me, userName: session.name, readAt: now }])
        for (const n of related) await repo.update('notifications', n.id, { readAt: now })
      },
      { action: 'Confirmó lectura', detail: a.title, kind: 'acceso' },
    )
  }

  return (
    <>
      <PageHeader
        title={session.role === 'docente' ? 'Mensajes y avisos' : 'Avisos'}
        subtitle="Comunicación de la escuela con las familias, con confirmación de lectura."
        actions={canWrite ? <Button icon="enviar" onClick={() => setComposer(true)}>{session.role === 'admin' ? 'Publicar aviso' : 'Enviar mensaje al grupo'}</Button> : undefined}
      />
      <Tabs
        label="Tipo de comunicación"
        value={view}
        onChange={setView}
        options={(['aviso', 'mensaje'] as const).map((k) => {
          const items = all.filter((a) => a.kind === k)
          const pending = canWrite ? 0 : items.filter((a) => !isRead(a)).length
          return { value: k, label: `${k === 'aviso' ? 'Avisos institucionales' : 'Mensajes de grupo'} (${items.length})${pending ? ` · ${pending} sin leer` : ''}` }
        })}
      />
      {list.length === 0 ? (
        <EmptyState icon={view === 'aviso' ? 'avisos' : 'mensajes'} title={view === 'aviso' ? 'No hay avisos' : 'No hay mensajes de grupo'} />
      ) : (
        <ul className="space-y-3">
          {list.map((a) => {
            const read = isRead(a)
            const recipients = recipientsOf(db, a)
            const readers = familiesRead(db, a, recipients)
            const author = canWrite && (session.role === 'admin' || a.authorId === session.personId)
            return (
              <li key={a.id}>
                <Card as="article" className={!read && !canWrite ? 'border-l-4 border-l-primary' : ''}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-heading">{a.title}</h2>
                      <p className="text-xs text-muted">{a.authorName} · {formatDateTime(a.createdAt)} · {audienceLabel(db, a.audience)}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {!canWrite && (read ? <Badge tone="exito">Leído</Badge> : <Badge tone="info">Nuevo</Badge>)}
                      {a.requiresAck && <Badge tone="aviso">Requiere confirmación</Badge>}
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-line">{a.body}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {!canWrite && !read && (
                      <Button variant={a.requiresAck ? 'primario' : 'secundario'} icon="check" onClick={() => void acknowledge(a)}>
                        {a.requiresAck ? 'Enterado, confirmo lectura' : 'Marcar como leído'}
                      </Button>
                    )}
                    {author && (
                      <>
                        <span className="text-sm text-muted">Leído por {readers.length} de {plural(recipients.length, 'familia', 'familias')}</span>
                        <Button variant="fantasma" icon="ojo" onClick={() => setDetail(a)}>Ver acuses</Button>
                      </>
                    )}
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
      <Modal open={composer} onClose={() => setComposer(false)} title={session.role === 'admin' ? 'Publicar aviso' : 'Mensaje al grupo'}>
        <Composer onDone={(k) => { setComposer(false); setView(k) }} />
      </Modal>
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Acuses de lectura">
        {detail && <Receipts a={detail} />}
      </Modal>
    </>
  )
}

function Receipts({ a }: { a: Announcement }) {
  const { db } = useApp()
  const families = recipientsOf(db, a)
  const read = familiesRead(db, a, families)
  const pending = families.filter((f) => !read.includes(f))
  const readAt = (f: Family) => db.receipts.filter((r) => r.announcementId === a.id && f.guardians.some((g) => r.userKey === `familia:${g.id}`)).map((r) => r.readAt).sort()[0]
  const names = (f: Family) => f.guardians.map((g) => `${g.firstName} ${g.lastName}`).join(' y ')
  return (
    <div className="space-y-4 text-sm">
      <p className="font-semibold text-heading">{a.title}</p>
      <div>
        <h3 className="mb-1 font-bold text-success">Confirmaron ({plural(read.length, 'familia', 'familias')})</h3>
        {read.length === 0 ? <p className="text-muted">Ninguna familia lo ha leído todavía.</p> : (
          <ul className="space-y-1">{read.map((f) => <li key={f.key} className="flex justify-between gap-2"><span>{names(f)}</span><span className="text-muted">{formatDateTime(readAt(f) ?? '')}</span></li>)}</ul>
        )}
      </div>
      <div>
        <h3 className="mb-1 font-bold text-warning">Pendientes ({plural(pending.length, 'familia', 'familias')})</h3>
        <ul className="space-y-1">{pending.slice(0, 40).map((f) => <li key={f.key}>{names(f)}</li>)}</ul>
        {pending.length > 40 && <p className="text-muted">y {pending.length - 40} más</p>}
      </div>
    </div>
  )
}

function Composer({ onDone }: { onDone: (k: View) => void }) {
  const { db, session, act } = useApp()
  const isAdmin = session.role === 'admin'
  const myGroups = isAdmin ? db.groups : db.groups.filter((g) => teacherGroupIds(db, session.personId).has(g.id))
  const [kind, setKind] = useState<View>(isAdmin ? 'aviso' : 'mensaje')
  const [scope, setScope] = useState<'escuela' | 'nivel' | 'grupo'>(isAdmin ? 'escuela' : 'grupo')
  const [level, setLevel] = useState<Level>(schoolLevels(db)[0] ?? 'primaria')
  const [groupId, setGroupId] = useState(myGroups[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [ack, setAck] = useState(true)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return setError('Escribe un título y el mensaje.')
    const audience: Audience = scope === 'escuela' ? { type: 'escuela' } : scope === 'nivel' ? { type: 'nivel', level } : { type: 'grupo', groupId }
    if (!isAdmin && (audience.type !== 'grupo' || !myGroups.some((g) => g.id === groupId))) return setError('Solo puedes escribir a tus grupos.')
    const k: View = isAdmin ? kind : 'mensaje'
    const now = nowISO()
    const a: Announcement = { id: uid('av'), kind: k, title: title.trim(), body: body.trim(), audience, authorId: session.personId, authorName: session.name, authorRole: session.role, createdAt: now, requiresAck: ack }
    // Cada tutor de las familias que lo reciben ve el aviso también en su campana.
    const notes: AppNotification[] = recipientsOf(db, a).flatMap((f) => f.guardians).map((g) => ({
      id: uid('nt'),
      userKey: `familia:${g.id}`,
      kind: 'aviso',
      title: k === 'aviso' ? `Aviso: ${a.title}` : `Mensaje de grupo: ${a.title}`,
      body: `${a.authorName}${ack ? ' · Pide confirmar lectura.' : ''}`,
      link: `/avisos?aviso=${a.id}`,
      at: now,
      readAt: null,
    }))
    await act(
      async (repo) => {
        await repo.insert('announcements', [a])
        if (notes.length) await repo.insert('notifications', notes)
      },
      { action: k === 'aviso' ? 'Publicó un aviso' : 'Envió mensaje de grupo', detail: `${title} · ${audienceLabel(db, audience)}` },
    )
    onDone(k)
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3" noValidate>
      {isAdmin && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tipo">
            {(id) => (
              <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as View)}>
                <option value="aviso">Aviso institucional</option>
                <option value="mensaje">Mensaje de grupo</option>
              </Select>
            )}
          </Field>
          <Field label="Para">
            {(id) => (
              <Select id={id} value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
                <option value="escuela">Toda la escuela</option>
                <option value="nivel">Un nivel</option>
                <option value="grupo">Un grupo</option>
              </Select>
            )}
          </Field>
        </div>
      )}
      {scope === 'nivel' && (
        <Field label="Nivel">
          {(id) => (
            <Select id={id} value={level} onChange={(e) => setLevel(e.target.value as Level)}>
              {schoolLevels(db).map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
            </Select>
          )}
        </Field>
      )}
      {scope === 'grupo' && (
        <Field label="Grupo">
          {(id) => (
            <Select id={id} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              {myGroups.map((g) => <option key={g.id} value={g.id}>{groupLabel(db, g)}</option>)}
            </Select>
          )}
        </Field>
      )}
      <Field label="Título">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
      <Field label="Mensaje">{(id) => <Textarea id={id} rows={5} value={body} onChange={(e) => setBody(e.target.value)} />}</Field>
      <Switch checked={ack} onChange={setAck} label="Pedir confirmación de lectura" description="Las familias verán un botón para confirmar que leyeron el aviso." />
      {error && <Notice tone="peligro">{error}</Notice>}
      <div className="flex justify-end">
        <Button type="submit" icon="enviar">Publicar</Button>
      </div>
    </form>
  )
}
