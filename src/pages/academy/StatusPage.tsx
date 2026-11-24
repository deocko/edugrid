import { useState, type ChangeEvent, type FormEvent } from 'react'
import { UPDATE_LABEL } from '../../lib/updates'
import { Icon } from '../../components/Icon'
import { Button, Card, EmptyState, Field, Notice, PageHeader, Select, Textarea } from '../../components/ui'
import type { AppNotification, StudentUpdate, UpdateCategory } from '../../data/types'
import { formatDateTime, nowISO, uid } from '../../lib/format'
import { compressPhoto, MAX_DEMO_PHOTOS } from '../../lib/photo'
import { groupLabel, studentName, visibleStudents } from '../../lib/scope'
import { useApp } from '../../state/context'
import { useManagedGroups } from './useTeacherGroups'

const CATEGORIES: UpdateCategory[] = ['llego', 'comio', 'participo', 'logro', 'necesita', 'salud', 'otro']
const SUGGESTED: Record<UpdateCategory, string> = {
  llego: 'Llegó contento y listo para trabajar.',
  comio: 'Comió todo su refrigerio.',
  participo: 'Participó mucho en clase hoy.',
  logro: '',
  necesita: 'Necesita traer mañana: ',
  salud: '',
  otro: '',
}

/** La docente envía a la familia una novedad del día, con foto opcional. */
export function StatusPage() {
  const { db, session, act } = useApp()
  const groups = useManagedGroups()
  const [groupId, setGroupId] = useState(groups[0]?.id ?? '')
  const students = visibleStudents(db, session).filter((s) => s.groupId === groupId).sort((a, b) => a.lastName.localeCompare(b.lastName))
  const [studentId, setStudentId] = useState('')
  const [category, setCategory] = useState<UpdateCategory>('participo')
  const [text, setText] = useState(SUGGESTED.participo)
  const [photo, setPhoto] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tone: 'exito' | 'peligro'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const current = students.find((s) => s.id === studentId) ?? students[0]
  const sent = db.studentUpdates.filter((u) => u.teacherId === session.personId).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8)

  const pickCategory = (c: UpdateCategory) => {
    setCategory(c)
    if (!text.trim() || Object.values(SUGGESTED).includes(text)) setText(SUGGESTED[c])
  }

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setPhoto(await compressPhoto(file))
    } catch (err) {
      setMsg({ tone: 'peligro', text: err instanceof Error ? err.message : 'No se pudo usar la foto.' })
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (!current) return
    if (!text.trim()) return setMsg({ tone: 'peligro', text: 'Escribe un mensaje corto para la familia.' })
    setBusy(true)
    const at = nowISO()
    const update: StudentUpdate = { id: uid('es'), studentId: current.id, teacherId: session.personId, teacherName: session.name, at, category, text: text.trim(), photo }
    const notes: AppNotification[] = current.guardianIds.map((g) => ({ id: uid('nt'), userKey: `familia:${g}`, kind: 'estatus', title: `Novedad de ${current.firstName}`, body: `${session.name}: ${text.trim()}${photo ? ' (con foto)' : ''}`, link: `/familia/hijo/${current.id}?vista=dia`, studentId: current.id, at, readAt: null }))
    // Si ya hay muchas fotos guardadas, se quita la foto más antigua (solo en la demo).
    const withPhotos = db.studentUpdates.filter((u) => u.photo).sort((a, b) => a.at.localeCompare(b.at))
    const trim = photo && withPhotos.length >= MAX_DEMO_PHOTOS ? withPhotos[0] : undefined
    await act(
      async (repo) => {
        if (trim) await repo.update('studentUpdates', trim.id, { photo: null })
        await repo.insert('studentUpdates', [update])
        await repo.insert('notifications', notes)
      },
      { action: 'Envió novedad a la familia', detail: `${studentName(current)} · ${UPDATE_LABEL[category]}${photo ? ' · con foto' : ''}` },
    )
    setBusy(false)
    setPhoto(null)
    setText(SUGGESTED[category])
    setMsg({ tone: 'exito', text: `Listo: la familia de ${current.firstName} ya recibió la novedad.` })
  }

  if (groups.length === 0) return <EmptyState icon="alumnos" title="No tienes grupos asignados" />

  return (
    <>
      <PageHeader title="Novedades para las familias" subtitle="Cuéntales cómo va su hija o hijo. Les llega al momento, con foto si quieres." />
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Card>
          <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Grupo">
                {(id) => (
                  <Select id={id} value={groupId} onChange={(e) => { setGroupId(e.target.value); setStudentId('') }}>
                    {groups.map((g) => <option key={g.id} value={g.id}>{groupLabel(db, g)}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Alumno">
                {(id) => (
                  <Select id={id} value={current?.id ?? ''} onChange={(e) => setStudentId(e.target.value)}>
                    {students.map((s) => <option key={s.id} value={s.id}>{studentName(s)}</option>)}
                  </Select>
                )}
              </Field>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-heading">¿Qué quieres contar?</legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button key={c} type="button" onClick={() => pickCategory(c)} aria-pressed={category === c} className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${category === c ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface text-heading hover:bg-surface-2'}`}>
                    {UPDATE_LABEL[c]}
                  </button>
                ))}
              </div>
            </fieldset>
            <Field label="Mensaje para la familia">{(id) => <Textarea id={id} rows={3} value={text} maxLength={400} onChange={(e) => setText(e.target.value)} />}</Field>
            <div>
              <p className="mb-2 text-sm font-semibold text-heading">Foto (opcional)</p>
              {photo ? (
                <div className="flex flex-wrap items-end gap-3">
                  <img src={photo} alt="Foto lista para enviar" className="max-h-48 rounded-xl" />
                  <Button variant="fantasma" icon="cerrar" onClick={() => setPhoto(null)}>Quitar foto</Button>
                </div>
              ) : (
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-link/40 px-4 text-sm font-semibold text-link hover:bg-info-bg">
                  <Icon name="camara" size={18} />
                  Tomar o elegir foto
                  <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => void onPhoto(e)} />
                </label>
              )}
              <p className="mt-2 text-xs text-muted">Toma fotos solo de este alumno o donde no se reconozca a otros niños. La foto solo la ven su familia, sus docentes y la dirección.</p>
            </div>
            {msg && <Notice tone={msg.tone} icon={msg.tone === 'exito' ? 'check' : 'alerta'}>{msg.text}</Notice>}
            <div className="flex justify-end">
              <Button type="submit" icon="enviar" disabled={busy || !current}>{busy ? 'Enviando…' : `Enviar a la familia de ${current?.firstName ?? ''}`}</Button>
            </div>
          </form>
        </Card>
        <Card title="Enviadas recientemente">
          {sent.length === 0 ? (
            <p className="text-sm text-muted">Aún no has enviado novedades.</p>
          ) : (
            <ul className="divide-y divide-line">
              {sent.map((u) => (
                <li key={u.id} className="py-2.5">
                  <p className="font-semibold text-heading">{studentName(db.students.find((s) => s.id === u.studentId))} · {UPDATE_LABEL[u.category]}</p>
                  <p className="text-sm">{u.text}</p>
                  <p className="text-xs text-muted">{formatDateTime(u.at)}{u.photo ? ' · con foto' : ''}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
