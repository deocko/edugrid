import { useId, useState } from 'react'
import type { Database } from '../data/types'
import { groupLabel } from '../lib/scope'
import { Avatar, Button, Input } from './ui'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/**
 * Busca a una madre, padre o tutor ya registrado por nombre o apellidos (sin importar acentos)
 * para vincular a un hermano. También encuentra por el nombre de los hijos que ya están inscritos.
 */
export function GuardianPicker({ db, value, onChange }: { db: Database; value: string; onChange: (id: string) => void }) {
  const [q, setQ] = useState('')
  const inputId = useId()
  const listId = useId()
  const kidsOf = (gid: string) => db.students.filter((s) => s.guardianIds.includes(gid) && s.status === 'activo')
  const selected = db.guardians.find((g) => g.id === value)

  if (selected) {
    const kids = kidsOf(selected.id)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary bg-info-bg px-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={`${selected.firstName} ${selected.lastName}`} size={36} />
          <div className="min-w-0">
            <p className="font-semibold text-heading">{selected.firstName} {selected.lastName} <span className="text-sm font-normal text-muted">· {selected.relation}</span></p>
            {kids.length > 0 && <p className="text-xs text-muted">Hermanos: {kids.map((k) => `${k.firstName} (${groupLabel(db, k.groupId)})`).join(', ')}</p>}
          </div>
        </div>
        <Button variant="fantasma" icon="cerrar" onClick={() => onChange('')}>Cambiar</Button>
      </div>
    )
  }

  const terms = norm(q).split(/\s+/).filter(Boolean)
  const results = terms.length === 0
    ? []
    : db.guardians
        .filter((g) => {
          const hay = norm(`${g.firstName} ${g.lastName} ${kidsOf(g.id).map((k) => `${k.firstName} ${k.lastName}`).join(' ')}`)
          return terms.every((t) => hay.includes(t))
        })
        .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-semibold text-heading">Buscar tutor registrado</label>
      <Input id={inputId} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Escribe apellidos o nombre, por ejemplo «Ortega»" autoComplete="off" aria-controls={listId} />
      <p className="text-xs text-muted" role="status">
        {terms.length === 0 ? 'Escribe al menos un apellido o nombre. También puedes buscar por el nombre de un hermano.' : results.length === 0 ? 'No encontramos a nadie con ese nombre. Revisa la escritura o registra un tutor nuevo.' : `${results.length} ${results.length === 1 ? 'resultado' : 'resultados'}${results.length > 8 ? ' (mostramos 8; escribe más para afinar)' : ''}`}
      </p>
      {results.length > 0 && (
        <ul id={listId} className="divide-y divide-line rounded-xl border border-line">
          {results.slice(0, 8).map((g) => {
            const kids = kidsOf(g.id)
            return (
              <li key={g.id}>
                <button type="button" onClick={() => { onChange(g.id); setQ('') }} className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2">
                  <Avatar name={`${g.firstName} ${g.lastName}`} size={32} />
                  <span className="min-w-0">
                    <span className="block font-semibold text-heading">{g.lastName}, {g.firstName} <span className="text-sm font-normal text-muted">· {g.relation}</span></span>
                    <span className="block text-xs text-muted">{kids.length ? `Hijos inscritos: ${kids.map((k) => `${k.firstName} (${groupLabel(db, k.groupId)})`).join(', ')}` : 'Sin hijos activos'}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
