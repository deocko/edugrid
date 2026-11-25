import { useRef, useState, type UIEvent } from 'react'
import { compressAvatar } from '../lib/photo'
import { useApp } from '../state/context'
import { Icon } from './Icon'
import { Avatar, Button, FilePickButton, Modal, Notice } from './ui'

/** Tablas de personas que tienen foto institucional y avatar. */
export type PersonTable = 'students' | 'teachers' | 'guardians' | 'staff'

const WHO: Record<PersonTable, string> = { students: 'alumno', teachers: 'docente', guardians: 'familia', staff: 'personal' }

export interface PersonPhotosProps {
  table: PersonTable
  id: string
  name: string
  /** Foto institucional: la toma la escuela al empadronar. Sirve para identificar. */
  photo?: string | null
  /** Avatar: la imagen que la persona elige en «Mi perfil». */
  profilePhoto?: string | null
}

/**
 * Las dos imágenes de una persona, una al lado de la otra: primero su avatar (la que
 * eligió para sentir la app suya) y, deslizando, la foto institucional que tomó la
 * escuela para identificarla. Solo la dirección cambia la foto institucional y puede
 * quitar un avatar que no sea adecuado.
 */
export function PersonPhotos({ table, id, name, photo = null, profilePhoto = null }: PersonPhotosProps) {
  const { session, act } = useApp()
  const canEdit = session.role === 'admin'
  const [slide, setSlide] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const track = useRef<HTMLDivElement>(null)
  /** Mientras se desliza al tocar una pestaña, se ignoran las posiciones intermedias. */
  const target = useRef<number | null>(null)
  const who = WHO[table]

  const go = (i: number) => {
    setSlide(i)
    const el = track.current
    if (!el || Math.abs(el.scrollLeft - i * el.clientWidth) < 2) return
    target.current = i
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }
  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth))
    if (target.current !== null) {
      if (Math.abs(el.scrollLeft - target.current * el.clientWidth) < 2) target.current = null
      return
    }
    if (i !== slide) setSlide(i)
  }

  const pick = async (file?: File) => {
    if (!file) return
    setError('')
    setBusy(true)
    try {
      const next = await compressAvatar(file)
      await act((repo) => repo.update(table, id, { photo: next }), { action: photo ? `Cambió foto institucional de ${who}` : `Tomó foto institucional de ${who}`, detail: name })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la foto.')
    } finally {
      setBusy(false)
    }
  }
  const removePhoto = () => act((repo) => repo.update(table, id, { photo: null }), { action: `Quitó foto institucional de ${who}`, detail: name })
  const removeAvatar = () => act((repo) => repo.update(table, id, { profilePhoto: null }), { action: `Quitó el avatar de ${who}`, detail: name })

  const slides = [
    {
      key: 'avatar',
      label: 'Avatar',
      tab: 'Avatar',
      src: profilePhoto,
      empty: 'Aún no elige su avatar.',
      note: `Lo elige ${who === 'familia' ? 'la familia' : who === 'alumno' ? 'el alumno' : 'la persona'} en «Mi perfil».`,
    },
    {
      key: 'institucional',
      label: 'Foto institucional',
      tab: 'Institucional',
      src: photo,
      empty: 'La escuela aún no toma su foto.',
      note: 'La toma la escuela al empadronar. Sirve para identificar.',
    },
  ]

  return (
    <div className="mx-auto w-full max-w-[16rem]">
      <div role="tablist" aria-label={`Fotos de ${name}`} className="mb-3 grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1 text-sm font-semibold">
        {slides.map((s, i) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={slide === i}
            aria-label={s.label}
            onClick={() => go(i)}
            className={`min-h-9 rounded-full px-2 transition-colors ${slide === i ? 'bg-primary text-on-primary shadow-sm' : 'text-muted hover:text-heading'}`}
          >
            {s.tab}
          </button>
        ))}
      </div>
      <div ref={track} onScroll={onScroll} className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-live="polite">
        {slides.map((s, i) => (
          <figure key={s.key} className="w-full shrink-0 snap-center" aria-hidden={slide !== i} data-foto={s.key}>
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-surface-2 ring-2 ring-cyan/50">
              {s.src ? (
                <img src={s.src} alt={`${s.label} de ${name}`} className="size-full object-cover" />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-3 p-4 text-center">
                  <Avatar name={name} size={88} />
                  <p className="text-sm text-muted">{s.empty}</p>
                </div>
              )}
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-navy/80 px-2.5 py-1 text-xs font-semibold text-white">
                <Icon name={i === 0 ? 'persona' : 'escudo'} size={14} />
                {s.label}
              </span>
            </div>
            <figcaption className="mt-2 text-center text-xs text-muted">{s.note}</figcaption>
          </figure>
        ))}
      </div>
      <div className="mt-2 flex justify-center gap-1.5" aria-hidden="true">
        {slides.map((s, i) => (
          <span key={s.key} className={`h-1.5 rounded-full transition-all ${slide === i ? 'w-5 bg-primary' : 'w-1.5 bg-line'}`} />
        ))}
      </div>
      {slide === 0 && <p className="mt-1 text-center text-xs text-muted">Desliza para ver la foto institucional.</p>}

      {canEdit && slide === 1 && (
        <div className="mt-3 flex flex-col gap-2">
          <FilePickButton icon="camara" accept="image/*" capture="environment" disabled={busy} onFile={(f) => void pick(f)}>
            {busy ? 'Guardando…' : photo ? 'Tomar foto nueva' : 'Tomar foto'}
          </FilePickButton>
          <FilePickButton variant="fantasma" icon="subir" accept="image/*" disabled={busy} onFile={(f) => void pick(f)}>
            Subir desde galería
          </FilePickButton>
          {photo && (
            <Button variant="fantasma" icon="cerrar" onClick={() => void removePhoto()}>
              Quitar foto institucional
            </Button>
          )}
        </div>
      )}
      {canEdit && slide === 0 && profilePhoto && (
        <div className="mt-3 flex flex-col gap-1">
          <Button variant="fantasma" icon="cerrar" onClick={() => void removeAvatar()}>
            Quitar avatar
          </Button>
          <p className="text-center text-xs text-muted">Úsalo si la imagen no es adecuada. La persona podrá elegir otra.</p>
        </div>
      )}
      {error && <div className="mt-3"><Notice tone="peligro">{error}</Notice></div>}
    </div>
  )
}

/** Avatar de una lista que, al tocarlo, abre las dos fotos de la persona. */
export function PersonAvatarButton({ size = 40, ...p }: PersonPhotosProps & { size?: number }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-full" aria-label={`Ver fotos de ${p.name}`}>
        <Avatar name={p.name} src={p.profilePhoto ?? p.photo} size={size} />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Fotos de ${p.name}`}>
        <PersonPhotos {...p} />
      </Modal>
    </>
  )
}
