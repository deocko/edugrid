import { useState, type FormEvent } from 'react'
import { Logo } from '../../brand/Logo'
import { Badge, Button, Card, Field, FilePickButton, Input, Notice, PageHeader } from '../../components/ui'
import type { Appearance, Branding, SubjectColor } from '../../data/types'
import { Icon } from '../../components/Icon'
import { appearanceOf, DEFAULT_APPEARANCE } from '../../lib/appearance'
import { SUBJECT_COLORS } from '../../lib/subjects'
import { DEFAULT_BRANDING, SCHOOL_PRESETS, brandTokens, brandingOf, isHex, logoToPng, placesOf, type SchoolPreset } from '../../lib/branding'
import { useApp } from '../../state/context'

const MAX_LOGO_BYTES = 2 * 1024 * 1024

/** Configuración de la escuela: identidad (nombre, logo, colores) y catálogo de lugares de entrada. */
export function SchoolSettings() {
  return (
    <>
      <PageHeader title="Configuración de la escuela" subtitle="Tu escuela con su propio logo y colores. Todos los miembros la ven así." />
      <div className="space-y-4">
        <PresetPicker />
        <IdentityForm />
        <AppearanceForm />
        <PlacesCatalog />
      </div>
    </>
  )
}

function PresetPicker() {
  const { db, act } = useApp()
  const [busy, setBusy] = useState('')
  const current = brandingOf(db.meta)
  const apply = async (p: SchoolPreset) => {
    setBusy(p.id)
    try {
      const logo = p.logoSvg ? await logoToPng(p.logoSvg) : null
      await act(
        (repo) => repo.updateMeta({ school: { ...db.meta.school, name: p.name, shortName: p.shortName }, branding: { logo, primary: p.primary, accent: p.accent } }),
        { action: 'Cambió la marca de la escuela', detail: `Escuela de ejemplo: ${p.name}` },
      )
    } finally {
      setBusy('')
    }
  }
  const active = (p: SchoolPreset) => db.meta.school.name === p.name && current.primary.toLowerCase() === p.primary && current.accent.toLowerCase() === p.accent
  return (
    <Card title="Prueba con otra escuela de ejemplo">
      <p className="mb-3 text-sm text-muted">EDUGRID se adapta a cada escuela que lo contrata. Elige una escuela ficticia para ver cómo cambia el encabezado, los colores y los documentos para todos los usuarios.</p>
      <ul className="grid gap-3 sm:grid-cols-3">
        {SCHOOL_PRESETS.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => void apply(p)}
              disabled={busy !== ''}
              aria-pressed={active(p)}
              className={`flex h-full w-full flex-col items-start gap-3 rounded-2xl border-2 bg-surface p-4 text-left transition hover:border-link disabled:opacity-60 ${active(p) ? 'border-primary' : 'border-line'}`}
            >
              <span className="flex h-12 items-center rounded-lg bg-white px-2">
                {p.logoSvg ? <img src={p.logoSvg} alt="" className="h-10 max-w-[11rem] object-contain" /> : <Logo height={26} tone="color" />}
              </span>
              <span className="text-sm font-semibold text-heading">{p.name}</span>
              <span className="flex items-center gap-1.5" aria-hidden="true">
                <span className="size-5 rounded-full" style={{ background: p.primary }} />
                <span className="size-5 rounded-full" style={{ background: p.accent }} />
              </span>
              {active(p) ? <Badge tone="exito">En uso</Badge> : <span className="text-sm font-semibold text-link">{busy === p.id ? 'Aplicando…' : 'Usar esta'}</span>}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function IdentityForm() {
  const { db, act } = useApp()
  const saved = brandingOf(db.meta)
  const [name, setName] = useState(db.meta.school.name)
  const [shortName, setShortName] = useState(db.meta.school.shortName)
  const [draft, setDraft] = useState<Branding>(saved)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  // Si otra acción (p. ej. una escuela de ejemplo) cambió lo guardado, el formulario se pone al día.
  const [seen, setSeen] = useState(JSON.stringify([db.meta.school.name, saved]))
  const key = JSON.stringify([db.meta.school.name, saved])
  if (key !== seen) {
    setSeen(key)
    setName(db.meta.school.name)
    setShortName(db.meta.school.shortName)
    setDraft(saved)
  }

  const t = brandTokens(draft)
  const pick = async (f?: File) => {
    if (!f) return
    setError('')
    if (!/^image\/(png|jpeg|svg\+xml|webp)$/.test(f.type)) return setError('Usa una imagen PNG, JPG, SVG o WebP.')
    if (f.size > MAX_LOGO_BYTES) return setError('El logo pesa más de 2 MB. Usa una versión más ligera.')
    try {
      setDraft({ ...draft, logo: await logoToPng(f) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el logo.')
    }
  }
  const save = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setOk('')
    if (!name.trim()) return setError('Escribe el nombre de la escuela.')
    if (!isHex(draft.primary) || !isHex(draft.accent)) return setError('Los colores deben tener formato #RRGGBB.')
    await act(
      (repo) => repo.updateMeta({ school: { ...db.meta.school, name: name.trim(), shortName: shortName.trim() || name.trim() }, branding: { ...draft, primary: draft.primary.toLowerCase(), accent: draft.accent.toLowerCase() } }),
      { action: 'Cambió la marca de la escuela', detail: name.trim() },
    )
    setOk('Listo. Todos los usuarios de la escuela ya ven el logo y los colores nuevos.')
  }

  return (
    <Card title="Logo, nombre y colores">
      <form onSubmit={(e) => void save(e)} className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Field label="Nombre de la escuela">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Nombre corto" hint="Se usa en la pestaña del navegador y en espacios pequeños.">{(id) => <Input id={id} value={shortName} onChange={(e) => setShortName(e.target.value)} />}</Field>
          <div>
            <p className="mb-2 text-sm font-semibold text-heading">Logo de la escuela</p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-16 min-w-24 items-center justify-center rounded-xl border border-line bg-white px-3">
                {draft.logo ? <img src={draft.logo} alt="Logo actual de la escuela" className="max-h-12 max-w-[12rem] object-contain" /> : <span className="text-xs text-[#4b5b72]">Sin logo</span>}
              </span>
              <FilePickButton icon="subir" accept="image/png,image/jpeg,image/svg+xml,image/webp" onFile={(f) => void pick(f)}>{draft.logo ? 'Cambiar logo' : 'Subir logo'}</FilePickButton>
              {draft.logo && <Button variant="fantasma" icon="cerrar" onClick={() => setDraft({ ...draft, logo: null })}>Quitar</Button>}
            </div>
            <p className="mt-1 text-xs text-muted">PNG con fondo transparente se ve mejor. Máximo 2 MB. Sin logo se muestra el de EDUGRID.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField label="Color principal" hint="Botones, enlaces y menú" value={draft.primary} onChange={(primary) => setDraft({ ...draft, primary })} />
            <ColorField label="Color de acento" hint="Detalles y avisos" value={draft.accent} onChange={(accent) => setDraft({ ...draft, accent })} />
          </div>
          {t.adjusted && <Notice tone="info">Oscurecimos un poco el color principal en botones y enlaces para que el texto se lea bien.</Notice>}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-heading">Así lo verán todos</p>
          <div className="overflow-hidden rounded-2xl border border-line bg-[#f3f6fa] text-[#243247]" aria-label="Vista previa de la marca">
            <div className="flex items-center gap-3 px-4 py-3" style={{ background: t.nav }}>
              {draft.logo ? (
                <span className="rounded-lg bg-white px-2 py-1"><img src={draft.logo} alt="" className="h-7 max-w-[9rem] object-contain" /></span>
              ) : (
                <Logo height={22} tone="invertida" />
              )}
              <span className="truncate text-sm font-semibold text-white">{name || 'Tu escuela'}</span>
            </div>
            <div className="space-y-3 p-4">
              <p className="text-sm font-bold" style={{ color: t.primary }}>Avisos</p>
              <p className="text-lg font-bold text-[#101d32]">Junta de padres el viernes</p>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: t.primary }}>Confirmar lectura</span>
                <span className="rounded-xl border px-4 py-2 text-sm font-semibold" style={{ color: t.primary, borderColor: t.primary }}>Ver más</span>
              </div>
              <span className="inline-block rounded-full px-2 py-0.5 text-xs font-bold text-[#101d32]" style={{ background: draft.accent }}>Nuevo</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 border-t border-[#e1e7ef] bg-white py-2 text-xs text-[#4b5b72]">
              {draft.logo ? (
                <>
                  by <Logo height={12} tone="color" />
                </>
              ) : (
                'EDUGRID · Administra tu Escuela'
              )}
            </div>
          </div>
        </div>

        {error && <div className="lg:col-span-2"><Notice tone="peligro">{error}</Notice></div>}
        {ok && <div className="lg:col-span-2" role="status"><Notice tone="exito" icon="check">{ok}</Notice></div>}
        <div className="flex flex-wrap justify-end gap-2 lg:col-span-2">
          <Button variant="secundario" onClick={() => setDraft(DEFAULT_BRANDING)}>Usar colores de EDUGRID</Button>
          <Button type="submit" icon="check">Guardar marca</Button>
        </div>
      </form>
    </Card>
  )
}

/** Colores de las tarjetas y del menú de abajo (celular y tableta), para toda la escuela. */
function AppearanceForm() {
  const { db, act } = useApp()
  const look = appearanceOf(db.meta)
  const [saved, setSaved] = useState('')
  const set = async (patch: Partial<Appearance>, label: string) => {
    const next = { ...look, ...patch }
    await act((repo) => repo.updateMeta({ appearance: next }), { action: 'Cambió los colores de tarjetas y menú', detail: label })
    setSaved(label)
  }
  const colorName = (c: SubjectColor) => SUBJECT_COLORS.find((x) => x.value === c)?.label ?? c
  return (
    <Card title="Colores de tarjetas y menú">
      <p className="mb-4 text-sm text-muted">Elige el fondo pastel de las tarjetas y del menú de abajo en el celular. Se aplica al momento para toda la escuela, en modo claro y oscuro.</p>
      <div className="space-y-5">
        <SwatchGroup
          legend="Fondo de las tarjetas"
          value={look.cards}
          special={[
            { value: 'seccion', label: 'Color de cada sección' },
            { value: 'blanco', label: 'Sin color' },
          ]}
          onChange={(v) => void set({ cards: v as Appearance['cards'] }, `Tarjetas: ${v === 'seccion' ? 'color de cada sección' : v === 'blanco' ? 'sin color' : colorName(v as SubjectColor)}`)}
        />
        <SwatchGroup
          legend="Fondo del menú de abajo"
          value={look.menu}
          special={[
            { value: 'tarjetas', label: 'Igual que las tarjetas' },
            { value: 'blanco', label: 'Sin color' },
          ]}
          onChange={(v) => void set({ menu: v as Appearance['menu'] }, `Menú: ${v === 'tarjetas' ? 'igual que las tarjetas' : v === 'blanco' ? 'sin color' : colorName(v as SubjectColor)}`)}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="secundario" onClick={() => void set(DEFAULT_APPEARANCE, 'Colores originales')}>Volver a los colores originales</Button>
        <span role="status" aria-live="polite">{saved && <Badge tone="exito">Guardado: {saved}</Badge>}</span>
      </div>
    </Card>
  )
}

function SwatchGroup({ legend, value, special, onChange }: { legend: string; value: string; special: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const chip = (on: boolean) => `inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-3 text-sm font-semibold transition ${on ? 'border-heading text-heading' : 'border-line text-heading hover:border-muted'}`
  return (
    <fieldset>
      <legend className="mb-2 block text-sm font-semibold text-heading">{legend}</legend>
      <div role="radiogroup" aria-label={legend} className="flex flex-wrap gap-2">
        {special.map((o) => {
          const on = value === o.value
          return (
            <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)} className={`${chip(on)} bg-surface`}>
              {o.value === 'blanco' ? (
                <span aria-hidden="true" className="size-5 rounded-full border border-line bg-surface" />
              ) : (
                <span aria-hidden="true" className="size-5 rounded-full bg-[conic-gradient(#f9d9c3,#d8e7fb,#d9f1e2,#f8d9ea,#e6dcfa,#f9d9c3)]" />
              )}
              {o.label}
              {on && <Icon name="check" size={16} />}
            </button>
          )
        })}
        {SUBJECT_COLORS.map((c) => {
          const on = value === c.value
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={c.label}
              title={c.label}
              onClick={() => onChange(c.value)}
              className={`subj-${c.value} inline-flex size-11 items-center justify-center rounded-full border-2 transition ${on ? 'border-heading' : 'border-transparent hover:border-line'}`}
            >
              <span className="inline-flex size-8 items-center justify-center rounded-full border border-[var(--s)] bg-[var(--s-bg)] text-[var(--s-ink)]">{on && <Icon name="check" size={16} />}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function ColorField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value)
  const [last, setLast] = useState(value)
  if (value !== last) {
    setLast(value)
    setText(value)
  }
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <div className="flex items-center gap-2">
          <input type="color" aria-label={`${label}: selector`} value={isHex(value) && value.length === 7 ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="size-11 shrink-0 cursor-pointer rounded-xl border border-line bg-surface p-1" />
          <Input
            id={id}
            value={text}
            maxLength={7}
            onChange={(e) => {
              const v = e.target.value.trim()
              setText(v)
              if (isHex(v)) onChange(v)
            }}
            className="font-mono uppercase"
          />
        </div>
      )}
    </Field>
  )
}

function PlacesCatalog() {
  const { db, act } = useApp()
  const places = placesOf(db.meta)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const save = (list: string[], action: string, detail: string) => act((repo) => repo.updateMeta({ checkinPlaces: list }), { action, detail })
  const add = async (e: FormEvent) => {
    e.preventDefault()
    const v = name.trim()
    setError('')
    if (!v) return
    if (places.some((p) => p.toLowerCase() === v.toLowerCase())) return setError('Ese lugar ya está en la lista.')
    await save([...places, v], 'Agregó lugar de entrada', v)
    setName('')
  }
  return (
    <Card title="Lugares de entrada y salida">
      <p className="mb-3 text-sm text-muted">Son las opciones de «Lugar» al escanear credenciales QR. Quedan en el registro de cada entrada y salida.</p>
      <ul className="mb-4 divide-y divide-line">
        {places.map((p) => (
          <li key={p} className="flex items-center justify-between gap-2 py-2">
            <span className="flex items-center gap-2 font-semibold text-heading">
              <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
              {p}
            </span>
            <Button
              variant="fantasma"
              icon="cerrar"
              disabled={places.length === 1}
              aria-label={`Quitar ${p}`}
              onClick={() => void save(places.filter((x) => x !== p), 'Quitó lugar de entrada', p)}
            >
              Quitar
            </Button>
          </li>
        ))}
      </ul>
      <form onSubmit={(e) => void add(e)} className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field label="Nuevo lugar">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Puerta de estacionamiento" />}</Field>
        </div>
        <Button type="submit" icon="mas">Agregar</Button>
      </form>
      {error && <div className="mt-3"><Notice tone="peligro">{error}</Notice></div>}
    </Card>
  )
}
