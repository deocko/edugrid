import { useRef, useState } from 'react'
import type { Student } from '../data/types'
import { compressAvatar } from '../lib/photo'
import { studentName } from '../lib/scope'
import { useApp } from '../state/context'
import { Avatar, Button, Notice } from './ui'

/** Foto del alumno en su expediente. Solo la dirección la puede subir, cambiar o quitar. */
export function StudentPhoto({ student }: { student: Student }) {
  const { session, act } = useApp()
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const canEdit = session.role === 'admin'
  const name = studentName(student)

  const pick = async (file?: File) => {
    if (!file) return
    setError('')
    setBusy(true)
    try {
      const photo = await compressAvatar(file)
      await act((repo) => repo.update('students', student.id, { photo }), { action: student.photo ? 'Cambió foto de alumno' : 'Agregó foto de alumno', detail: name })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la foto.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-4">
      <Avatar name={name} src={student.photo} size={96} />
      {canEdit && (
        <div className="flex flex-col gap-2">
          <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void pick(e.target.files?.[0])} />
          <Button variant="secundario" icon="camara" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? 'Guardando…' : student.photo ? 'Cambiar foto' : 'Agregar foto'}
          </Button>
          {student.photo && (
            <Button variant="fantasma" icon="cerrar" onClick={() => void act((repo) => repo.update('students', student.id, { photo: null }), { action: 'Quitó foto de alumno', detail: name })}>
              Quitar foto
            </Button>
          )}
        </div>
      )}
      {error && <div className="w-full"><Notice tone="peligro">{error}</Notice></div>}
    </div>
  )
}
