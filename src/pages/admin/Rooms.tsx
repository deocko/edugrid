import { useState, type FormEvent } from 'react'
import { Badge, Button, Card, Field, Input, Modal, Notice, PageHeader, Select } from '../../components/ui'
import type { Room } from '../../data/types'
import { plural, uid } from '../../lib/format'
import { groupLabel } from '../../lib/scope'
import { useApp } from '../../state/context'

const KIND: Record<Room['kind'], string> = { salon: 'Salón', laboratorio: 'Laboratorio', computo: 'Cómputo', deportivo: 'Deportivo', otro: 'Otro' }

/** Aulas: salones y espacios, su cupo y qué grupo usa cada uno. */
export function Rooms() {
  const { db, act } = useApp()
  const [editing, setEditing] = useState<Room | 'nueva' | null>(null)
  const [assign, setAssign] = useState<Room | null>(null)
  const rooms = [...db.rooms].sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }))
  const groupsIn = (r: Room) => db.groups.filter((g) => g.room === r.name)
  const studentsIn = (r: Room) => db.students.filter((s) => s.status === 'activo' && groupsIn(r).some((g) => g.id === s.groupId)).length
  const freeGroups = db.groups.filter((g) => !db.rooms.some((r) => r.name === g.room))

  return (
    <>
      <PageHeader title="Aulas" subtitle="Salones y espacios de la escuela, su cupo y el grupo que los ocupa." actions={<Button icon="mas" onClick={() => setEditing('nueva')}>Agregar aula</Button>} />
      {freeGroups.length > 0 && <div className="mb-4"><Notice tone="aviso">{plural(freeGroups.length, 'grupo no tiene', 'grupos no tienen')} aula asignada: {freeGroups.map((g) => groupLabel(db, g)).join(', ')}.</Notice></div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rooms.map((r) => {
          const gs = groupsIn(r)
          const n = studentsIn(r)
          const over = n > r.capacity
          return (
            <Card key={r.id} as="article">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-bold text-heading">{r.name}</h2>
                  <p className="text-sm text-muted">{KIND[r.kind]} · {r.floor} · cupo {r.capacity}</p>
                </div>
                {over ? <Badge tone="peligro">Sobrecupo</Badge> : gs.length ? <Badge tone="exito">Ocupada</Badge> : <Badge>Libre</Badge>}
              </div>
              <p className="mt-3 text-sm">{gs.length ? `${gs.map((g) => groupLabel(db, g)).join(', ')} · ${plural(n, 'alumno', 'alumnos')}` : 'Sin grupo asignado'}</p>
              {r.notes && <p className="mt-1 text-xs text-muted">{r.notes}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secundario" icon="alumnos" onClick={() => setAssign(r)}>Asignar grupo</Button>
                <Button variant="fantasma" onClick={() => setEditing(r)}>Editar</Button>
              </div>
            </Card>
          )
        })}
      </div>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'nueva' ? 'Agregar aula' : 'Editar aula'}>
        {editing !== null && <RoomForm room={editing === 'nueva' ? null : editing} onDone={() => setEditing(null)} />}
      </Modal>
      <Modal open={!!assign} onClose={() => setAssign(null)} title={`Asignar grupo a ${assign?.name ?? ''}`}>
        {assign && (
          <AssignForm
            room={assign}
            onSave={async (groupId) => {
              const g = db.groups.find((x) => x.id === groupId)
              if (g) await act((repo) => repo.update('groups', g.id, { room: assign.name }), { action: 'Asignó aula', detail: `${groupLabel(db, g)} → ${assign.name}` })
              setAssign(null)
            }}
          />
        )}
      </Modal>
    </>
  )
}

function AssignForm({ room, onSave }: { room: Room; onSave: (groupId: string) => Promise<void> }) {
  const { db } = useApp()
  const [groupId, setGroupId] = useState(db.groups[0]?.id ?? '')
  const g = db.groups.find((x) => x.id === groupId)
  return (
    <form onSubmit={(e) => { e.preventDefault(); void onSave(groupId) }} className="space-y-3">
      <Field label="Grupo">
        {(id) => <Select id={id} value={groupId} onChange={(e) => setGroupId(e.target.value)}>{db.groups.map((x) => <option key={x.id} value={x.id}>{groupLabel(db, x)} (hoy: {x.room})</option>)}</Select>}
      </Field>
      {g && g.room !== room.name && <p className="text-sm text-muted">{groupLabel(db, g)} deja {g.room} y pasa a {room.name}.</p>}
      <div className="flex justify-end"><Button type="submit" icon="check">Asignar</Button></div>
    </form>
  )
}

function RoomForm({ room, onDone }: { room: Room | null; onDone: () => void }) {
  const { db, act } = useApp()
  const [form, setForm] = useState({ name: room?.name ?? '', kind: room?.kind ?? ('salon' as Room['kind']), capacity: String(room?.capacity ?? 30), floor: room?.floor ?? 'Planta baja', notes: room?.notes ?? '' })
  const [error, setError] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const name = form.name.trim()
    const capacity = Number(form.capacity)
    if (!name) return setError('Escribe el nombre del aula.')
    if (db.rooms.some((r) => r.name.toLowerCase() === name.toLowerCase() && r.id !== room?.id)) return setError('Ya existe un aula con ese nombre.')
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) return setError('El cupo debe ser un número entre 1 y 500.')
    const data = { name, kind: form.kind, capacity, floor: form.floor.trim(), notes: form.notes.trim() }
    await act(
      async (repo) => {
        if (room) {
          await repo.update('rooms', room.id, data)
          // Si cambió el nombre, los grupos que la usan se actualizan
          if (room.name !== name) for (const g of db.groups.filter((x) => x.room === room.name)) await repo.update('groups', g.id, { room: name })
        } else await repo.insert('rooms', [{ id: uid('au'), ...data }])
      },
      { action: room ? 'Editó aula' : 'Agregó aula', detail: `${name} · cupo ${capacity}` },
    )
    onDone()
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-3 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2"><Field label="Nombre">{(id) => <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Salón 117" />}</Field></div>
      <Field label="Tipo">{(id) => <Select id={id} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Room['kind'] })}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
      <Field label="Cupo (alumnos)">{(id) => <Input id={id} type="number" inputMode="numeric" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />}</Field>
      <Field label="Piso o edificio">{(id) => <Input id={id} value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />}</Field>
      <Field label="Notas (opcional)">{(id) => <Input id={id} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}</Field>
      {error && <div className="sm:col-span-2"><Notice tone="peligro">{error}</Notice></div>}
      <div className="flex justify-end sm:col-span-2"><Button type="submit" icon="check">Guardar</Button></div>
    </form>
  )
}
