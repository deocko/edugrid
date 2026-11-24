import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, Modal, Notice, PageHeader, Select } from '../../components/ui'
import type { Guardian, Student } from '../../data/types'
import { nowISO, plural, uid } from '../../lib/format'
import { groupLabel, studentName } from '../../lib/scope'
import { useApp } from '../../state/context'

const RELATIONS: Guardian['relation'][] = ['Madre', 'Padre', 'Tutora', 'Tutor']
const PHONE_RE = /^[\d\s+()-]{10,}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Familias: dar de alta a mamá, papá o tutor y vincularlos con uno o varios hijos. */
export function Families() {
  const { db } = useApp()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Guardian | 'nuevo' | null>(null)
  const [done, setDone] = useState('')
  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return [...db.guardians]
      .map((g) => ({ g, kids: db.students.filter((s) => s.status === 'activo' && s.guardianIds.includes(g.id)) }))
      .filter(({ g, kids }) => !term || `${g.firstName} ${g.lastName} ${g.phone} ${kids.map(studentName).join(' ')}`.toLowerCase().includes(term))
      .sort((a, b) => a.g.lastName.localeCompare(b.g.lastName))
  }, [db, q])

  return (
    <>
      <PageHeader title="Familias" subtitle="Mamás, papás y tutores. Una misma persona puede tener varios hijos en la escuela." actions={<Button icon="mas" onClick={() => setEditing('nuevo')}>Dar de alta familia</Button>} />
      {done && <div className="mb-4"><Notice tone="exito" icon="check">{done}</Notice></div>}
      <Card>
        <div className="mb-3 max-w-sm">
          <Field label="Buscar por nombre, teléfono o hijo">{(id) => <Input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
        </div>
        <p className="mb-2 text-sm text-muted">{plural(list.length, 'familia', 'familias')}</p>
        {list.length === 0 ? (
          <EmptyState icon="hijo" title="No encontramos familias con esa búsqueda" />
        ) : (
          <ul className="divide-y divide-line">
            {list.slice(0, 80).map(({ g, kids }) => (
              <li key={g.id} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar name={`${g.firstName} ${g.lastName}`} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-heading">{g.firstName} {g.lastName} <span className="font-normal text-muted">· {g.relation}</span></p>
                  <p className="text-sm text-muted">{g.phone}{g.email ? ` · ${g.email}` : ''}</p>
                  <p className="mt-1 flex flex-wrap gap-1">
                    {kids.length === 0 ? <Badge tone="aviso">Sin hijos vinculados</Badge> : kids.map((k) => <Link key={k.id} to={`/alumnos/${k.id}`} className="no-underline"><Badge tone="info">{k.firstName} · {groupLabel(db, k.groupId)}</Badge></Link>)}
                    {!g.consentAt && <Badge tone="aviso">Falta consentimiento</Badge>}
                  </p>
                </div>
                <Button variant="secundario" icon="hijo" onClick={() => setEditing(g)}>Editar e hijos</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'nuevo' ? 'Dar de alta familia' : 'Editar familia e hijos'}>
        {editing !== null && <FamilyForm guardian={editing === 'nuevo' ? null : editing} onDone={(text) => { setEditing(null); setDone(text) }} />}
      </Modal>
    </>
  )
}

function FamilyForm({ guardian, onDone }: { guardian: Guardian | null; onDone: (text: string) => void }) {
  const { db, act } = useApp()
  const [form, setForm] = useState({
    firstName: guardian?.firstName ?? '',
    lastName: guardian?.lastName ?? '',
    relation: guardian?.relation ?? ('Madre' as Guardian['relation']),
    phone: guardian?.phone ?? '',
    email: guardian?.email ?? '',
    consent: !!guardian?.consentAt,
  })
  const initial = db.students.filter((s) => guardian && s.guardianIds.includes(guardian.id)).map((s) => s.id)
  const [kids, setKids] = useState<string[]>(initial)
  const [q, setQ] = useState('')
  const [error, setError] = useState('')
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const term = q.trim().toLowerCase()
  const options: Student[] = db.students
    .filter((s) => s.status === 'activo')
    .filter((s) => kids.includes(s.id) || (term.length >= 2 && studentName(s).toLowerCase().includes(term)))
    .sort((a, b) => Number(kids.includes(b.id)) - Number(kids.includes(a.id)) || a.lastName.localeCompare(b.lastName))
    .slice(0, 12)

  const toggle = (id: string) => setKids((k) => (k.includes(id) ? k.filter((x) => x !== id) : [...k, id]))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.firstName.trim() || !form.lastName.trim()) return setError('Escribe nombre y apellidos.')
    if (!PHONE_RE.test(form.phone.trim())) return setError('Escribe un teléfono de al menos 10 dígitos.')
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) return setError('El correo no tiene un formato válido.')
    if (kids.length === 0) return setError('Elige al menos un hijo o hija.')
    if (!form.consent) return setError('Se necesita el consentimiento del aviso de privacidad para registrar a la familia.')
    // Nadie se queda sin tutor: no se puede quitar al único tutor de un alumno.
    const removed = initial.filter((id) => !kids.includes(id))
    const orphan = removed.map((id) => db.students.find((s) => s.id === id)).find((s) => s && s.guardianIds.length <= 1)
    if (orphan) return setError(`${studentName(orphan)} se quedaría sin tutor. Primero registra a otra persona para ese alumno.`)

    const id = guardian?.id ?? uid('tu')
    const now = nowISO()
    const data = { firstName: form.firstName.trim(), lastName: form.lastName.trim(), relation: form.relation, phone: form.phone.trim(), email: form.email.trim(), consentAt: guardian?.consentAt ?? now }
    await act(
      async (repo) => {
        if (guardian) await repo.update('guardians', id, data)
        else await repo.insert('guardians', [{ id, ...data, rfc: 'XAXX010101000', taxName: 'PUBLICO EN GENERAL', taxZip: db.meta.cfdiConfig.codigoPostal, taxRegime: '616' }])
        for (const sid of kids.filter((x) => !initial.includes(x))) {
          const s = db.students.find((x) => x.id === sid)
          if (s) await repo.update('students', sid, { guardianIds: [...s.guardianIds, id] })
        }
        for (const sid of removed) {
          const s = db.students.find((x) => x.id === sid)
          if (s) await repo.update('students', sid, { guardianIds: s.guardianIds.filter((g) => g !== id) })
        }
      },
      { action: guardian ? 'Actualizó familia' : 'Dio de alta familia', detail: `${data.firstName} ${data.lastName} · ${plural(kids.length, 'hijo', 'hijos')}` },
    )
    onDone(`${data.firstName} ${data.lastName} quedó ${guardian ? 'actualizada' : 'registrada'} con ${plural(kids.length, 'hijo', 'hijos')}. Ya puede entrar como Familia y ver la credencial QR de cada uno.`)
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre(s)">{(id) => <Input id={id} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} autoComplete="off" />}</Field>
        <Field label="Apellidos">{(id) => <Input id={id} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} autoComplete="off" />}</Field>
        <Field label="Parentesco">
          {(id) => <Select id={id} value={form.relation} onChange={(e) => set('relation', e.target.value as Guardian['relation'])}>{RELATIONS.map((r) => <option key={r}>{r}</option>)}</Select>}
        </Field>
        <Field label="Teléfono celular">{(id) => <Input id={id} type="tel" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="off" />}</Field>
        <div className="sm:col-span-2">
          <Field label="Correo (opcional)">{(id) => <Input id={id} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="off" />}</Field>
        </div>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-heading">Hijas e hijos ({kids.length})</legend>
        <Field label="Buscar alumno para agregar">{(id) => <Input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Escribe al menos 2 letras" />}</Field>
        <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
          {options.map((s) => (
            <li key={s.id}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-surface-2">
                <input type="checkbox" checked={kids.includes(s.id)} onChange={() => toggle(s.id)} className="size-5 accent-[var(--c-primary)]" />
                <span className="min-w-0"><span className="font-semibold text-heading">{studentName(s)}</span> <span className="text-sm text-muted">· {groupLabel(db, s.groupId)}</span></span>
              </label>
            </li>
          ))}
          {options.length === 0 && <li className="px-2 text-sm text-muted">Busca a los alumnos por nombre para vincularlos.</li>}
        </ul>
      </fieldset>
      <label className="flex items-start gap-3 rounded-xl bg-surface-2 p-3 text-sm">
        <input type="checkbox" checked={form.consent} disabled={!!guardian?.consentAt} onChange={(e) => set('consent', e.target.checked)} className="mt-0.5 size-5 accent-[var(--c-primary)]" />
        <span>La madre, padre o tutor leyó el <Link to="/privacidad" className="font-semibold text-link underline" target="_blank">aviso de privacidad</Link> y da su consentimiento.</span>
      </label>
      {error && <Notice tone="peligro">{error}</Notice>}
      <div className="flex justify-end">
        <Button type="submit" icon="check">{guardian ? 'Guardar cambios' : 'Dar de alta'}</Button>
      </div>
    </form>
  )
}
