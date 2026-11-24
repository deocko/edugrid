import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { Avatar, Button, Card, EmptyState, Field, Modal, Notice, PageHeader, Select, Textarea } from '../../components/ui'
import type { AppNotification, ChatMessage, ChatThread } from '../../data/types'
import { contactsFor, myThreads, otherKey, unreadIn } from '../../lib/chat'
import { formatDateTime, nowISO, uid } from '../../lib/format'
import { studentName, teacherName, userKey } from '../../lib/scope'
import { useApp } from '../../state/context'

/** Chat entre docentes y familias. */
export function ChatPage() {
  const { db, session } = useApp()
  const [params, setParams] = useSearchParams()
  const me = userKey(session)
  const threads = myThreads(db, session)
    .map((t) => ({ t, last: db.chatMessages.filter((m) => m.threadId === t.id).sort((a, b) => b.at.localeCompare(a.at))[0] }))
    .sort((a, b) => (b.last?.at ?? b.t.createdAt).localeCompare(a.last?.at ?? a.t.createdAt))
  const openId = params.get('c')
  const open = threads.find((x) => x.t.id === openId)?.t
  const [creating, setCreating] = useState(false)

  const title = (t: ChatThread) => {
    const st = db.students.find((s) => s.id === t.studentId)
    if (session.role === 'familia') return { name: teacherName(db, t.teacherId), about: `Sobre ${st?.firstName ?? ''}` }
    const g = db.guardians.find((x) => x.id === t.guardianId)
    return { name: g ? `${g.firstName} ${g.lastName}` : 'Familia', about: `${g?.relation ?? 'Familia'} de ${studentName(st)}` }
  }

  return (
    <>
      <PageHeader
        title="Chat"
        subtitle={session.role === 'familia' ? 'Escribe directo a las maestras y maestros de tus hijos.' : 'Conversaciones con las familias de tus grupos.'}
        actions={<Button icon="chat" onClick={() => setCreating(true)}>Nueva conversación</Button>}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card className={open ? 'hidden lg:block' : ''} title="Conversaciones">
          {threads.length === 0 ? (
            <EmptyState icon="chat" title="Aún no tienes conversaciones" action={<Button variant="secundario" onClick={() => setCreating(true)}>Empezar una</Button>} />
          ) : (
            <ul className="-mx-2 space-y-1">
              {threads.map(({ t, last }) => {
                const n = unreadIn(db, t.id, me)
                const { name, about } = title(t)
                return (
                  <li key={t.id}>
                    <button type="button" onClick={() => setParams({ c: t.id })} aria-current={open?.id === t.id} className={`flex w-full items-center gap-3 rounded-xl p-2 text-left ${open?.id === t.id ? 'bg-info-bg' : 'hover:bg-surface-2'}`}>
                      <Avatar name={name} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-heading">{name}</span>
                        <span className="block truncate text-xs text-muted">{about}{last ? ` · ${last.text}` : ''}</span>
                      </span>
                      {n > 0 && <span className="rounded-full bg-primary px-2 text-xs font-bold text-on-primary" aria-label={`${n} sin leer`}>{n}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
        {open ? (
          <Conversation key={open.id} thread={open} title={title(open)} onBack={() => setParams({})} />
        ) : (
          <Card className="hidden lg:block"><EmptyState icon="chat" title="Elige una conversación">O empieza una nueva con el botón de arriba.</EmptyState></Card>
        )}
      </div>
      <Modal open={creating} onClose={() => setCreating(false)} title="Nueva conversación">
        <NewThread onClose={() => setCreating(false)} onOpen={(id) => { setCreating(false); setParams({ c: id }) }} />
      </Modal>
    </>
  )
}

function Conversation({ thread, title, onBack }: { thread: ChatThread; title: { name: string; about: string }; onBack: () => void }) {
  const { db, session, act } = useApp()
  const me = userKey(session)
  const [text, setText] = useState('')
  const endRef = useRef<HTMLLIElement>(null)
  const messages = db.chatMessages.filter((m) => m.threadId === thread.id).sort((a, b) => a.at.localeCompare(b.at))
  const unread = messages.filter((m) => m.fromKey !== me && !m.readAt)

  // Al abrir la conversación se marcan como leídos los mensajes recibidos.
  useEffect(() => {
    if (unread.length === 0) return
    const at = nowISO()
    void act(async (repo) => {
      for (const m of unread) await repo.update('chatMessages', m.id, { readAt: at })
      for (const n of db.notifications.filter((x) => x.userKey === me && x.kind === 'chat' && !x.readAt && x.link.endsWith(thread.id))) await repo.update('notifications', n.id, { readAt: at })
    })
  }, [unread.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.length])

  const send = async (e: FormEvent) => {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    const at = nowISO()
    const msg: ChatMessage = { id: uid('cm'), threadId: thread.id, fromKey: me, fromName: session.name, text: body, at, readAt: null }
    const to = otherKey(thread, session)
    const link = to.startsWith('familia') ? `/familia/chat?c=${thread.id}` : `/docente/chat?c=${thread.id}`
    const note: AppNotification = { id: uid('nt'), userKey: to, kind: 'chat', title: `Mensaje de ${session.name}`, body: body.length > 120 ? `${body.slice(0, 117)}…` : body, link, studentId: thread.studentId, at, readAt: null }
    setText('')
    await act(async (repo) => {
      await repo.insert('chatMessages', [msg])
      await repo.insert('notifications', [note])
    })
  }

  return (
    <section className="flex min-h-[28rem] min-w-0 flex-col rounded-2xl border border-line bg-surface" aria-label={`Conversación con ${title.name}`}>
      <header className="flex items-center gap-3 border-b border-line p-3 sm:p-4">
        <Button variant="fantasma" icon="izquierda" onClick={onBack} className="lg:hidden" aria-label="Volver a conversaciones" />
        <Avatar name={title.name} size={40} />
        <div className="min-w-0">
          <h2 className="truncate font-bold text-heading">{title.name}</h2>
          <p className="truncate text-xs text-muted">{title.about}</p>
        </div>
      </header>
      <ol className="flex-1 space-y-2 overflow-y-auto p-3 sm:p-4" aria-live="polite">
        {messages.length === 0 && <li className="text-center text-sm text-muted">Escribe el primer mensaje.</li>}
        {messages.map((m) => {
          const mine = m.fromKey === me
          return (
            <li key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${mine ? 'rounded-br-md bg-primary text-on-primary' : 'rounded-bl-md bg-surface-2 text-ink'}`}>
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                <p className={`mt-1 text-[11px] ${mine ? 'text-white/85' : 'text-muted'}`}>
                  {formatDateTime(m.at)}
                  {mine && (m.readAt ? ' · Visto' : ' · Enviado')}
                </p>
              </div>
            </li>
          )
        })}
        <li ref={endRef} aria-hidden="true" />
      </ol>
      <form onSubmit={(e) => void send(e)} className="flex items-end gap-2 border-t border-line p-3">
        <label htmlFor="chat-texto" className="sr-only">Mensaje</label>
        <Textarea
          id="chat-texto"
          rows={1}
          value={text}
          maxLength={1000}
          placeholder="Escribe un mensaje"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }}
          className="min-h-11 flex-1 resize-none"
        />
        <Button type="submit" icon="enviar" disabled={!text.trim()}>Enviar</Button>
      </form>
    </section>
  )
}

function NewThread({ onClose, onOpen }: { onClose: () => void; onOpen: (id: string) => void }) {
  const { db, session, act } = useApp()
  const contacts = contactsFor(db, session)
  const [pick, setPick] = useState(0)
  const start = async (e: FormEvent) => {
    e.preventDefault()
    const c = contacts[pick]
    if (!c) return
    const existing = db.chatThreads.find((t) => t.teacherId === c.teacherId && t.guardianId === c.guardianId && t.studentId === c.studentId)
    if (existing) return onOpen(existing.id)
    const t: ChatThread = { id: uid('ch'), teacherId: c.teacherId, guardianId: c.guardianId, studentId: c.studentId, createdAt: nowISO() }
    await act((repo) => repo.insert('chatThreads', [t]), { action: 'Abrió conversación', detail: c.label })
    onOpen(t.id)
  }
  return (
    <form onSubmit={(e) => void start(e)} className="space-y-4">
        {contacts.length === 0 ? (
          <Notice>No hay con quién conversar todavía.</Notice>
        ) : (
          <Field label={session.role === 'familia' ? '¿Con qué maestra o maestro?' : '¿Con qué familia?'}>
            {(id) => (
              <Select id={id} value={pick} onChange={(e) => setPick(Number(e.target.value))}>
                {contacts.map((c, i) => <option key={`${c.teacherId}-${c.guardianId}-${c.studentId}`} value={i}>{c.label}</option>)}
              </Select>
            )}
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secundario" onClick={onClose}>Cancelar</Button>
          <Button type="submit" icon="chat" disabled={contacts.length === 0}>Abrir conversación</Button>
        </div>
    </form>
  )
}
