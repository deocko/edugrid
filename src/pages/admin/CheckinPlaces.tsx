import { useState, type FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { Button, Card, Field, Input, LinkButton, Notice, PageHeader } from '../../components/ui'
import { placesOf } from '../../lib/branding'
import { useApp } from '../../state/context'

/** Entradas con QR: dónde se escanean las credenciales (catálogo de lugares de entrada y salida). */
export function CheckinPlaces() {
  return (
    <>
      <PageHeader title="Entradas con QR" subtitle="Configura dónde se leen las credenciales al entrar y salir de la escuela." actions={<LinkButton to="/admin/entradas" icon="qr">Ir a escanear</LinkButton>} />
      <div className="space-y-4">
        <PlacesCatalog />
        <Card title="Cómo se usa">
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2"><Icon name="qr" size={18} className="mt-0.5 text-link" />Quien escanea elige el lugar antes de leer la credencial.</li>
            <li className="flex gap-2"><Icon name="asistencia" size={18} className="mt-0.5 text-link" />La primera entrada del día marca la asistencia del alumno.</li>
            <li className="flex gap-2"><Icon name="campana" size={18} className="mt-0.5 text-link" />La familia recibe un aviso con la hora y el lugar.</li>
          </ul>
        </Card>
      </div>
    </>
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
