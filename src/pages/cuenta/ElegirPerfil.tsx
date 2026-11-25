import { useState } from 'react'
import { Icon, type IconName } from '../../components/Icon'
import { Notice } from '../../components/ui'
import { NOMBRE_PERFIL, type PerfilPublico, type TipoPerfil } from '../../data/cuentaTipos'

const ICONO: Record<TipoPerfil, IconName> = { administrador: 'escudo', docente: 'docente', familia: 'hijo', alumno: 'libro' }
const COLOR: Record<TipoPerfil, string> = { administrador: 'subj-indigo', docente: 'subj-verde', familia: 'subj-rosa', alumno: 'subj-azul' }

/** Lista de perfiles de una cuenta (por ejemplo, docente y familia) para elegir con cuál entrar. */
export function ElegirPerfil({ perfiles, actual, onElegir }: { perfiles: PerfilPublico[]; actual?: string | null; onElegir: (id: string) => Promise<void> }) {
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState('')
  return (
    <div className="grid gap-3">
      {perfiles.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={ocupado !== null}
          aria-current={p.id === actual ? 'true' : undefined}
          onClick={() => {
            setOcupado(p.id)
            setError('')
            onElegir(p.id).catch((e: unknown) => {
              setError(e instanceof Error ? e.message : 'No se pudo cambiar de perfil.')
              setOcupado(null)
            })
          }}
          className={`${COLOR[p.tipo]} card-tint flex min-h-14 items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition hover:brightness-[0.98] disabled:opacity-60`}
        >
          <span className="rounded-xl bg-info-bg p-2.5 text-info"><Icon name={ICONO[p.tipo]} size={22} /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-heading">Entrar como {NOMBRE_PERFIL[p.tipo]}</span>
            <span className="block text-sm break-words text-muted">{p.nombre}{p.id === actual ? ' · perfil actual' : ''}</span>
          </span>
          <Icon name="derecha" size={18} className="text-muted" />
        </button>
      ))}
      {error && <Notice tone="peligro">{error}</Notice>}
    </div>
  )
}
