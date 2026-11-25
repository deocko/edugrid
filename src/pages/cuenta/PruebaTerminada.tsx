import { useState } from 'react'
import { Button, Notice } from '../../components/ui'
import { cuentaApi } from '../../data/cuenta'
import { formatDate } from '../../lib/format'
import { useStore } from '../../state/context'
import { AuthLayout } from './AuthLayout'

/** Al vencer los 30 días de prueba: no se entra a los datos; se ofrece contactar para contratar. */
export function PruebaTerminada() {
  const { cuenta, logout, actualizarCuenta } = useStore()
  const [error, setError] = useState('')
  if (!cuenta) return null
  const asunto = encodeURIComponent(`Quiero contratar EDUGRID para ${cuenta.escuela.nombre}`)
  const cuerpo = encodeURIComponent(`Hola, la prueba gratis de ${cuenta.escuela.nombre} terminó y queremos contratar EDUGRID.\n\nNombre: ${cuenta.usuario.nombre}\nCorreo: ${cuenta.usuario.correo}`)
  const c = cuenta.contacto
  const contacto = /^https?:\/\//.test(c) ? c : `mailto:${c}?subject=${asunto}&body=${cuerpo}`
  return (
    <AuthLayout title="Tu prueba terminó" subtitle={`Los 30 días de prueba gratis de ${cuenta.escuela.nombre} terminaron${cuenta.escuela.trialEndsAt ? ` el ${formatDate(cuenta.escuela.trialEndsAt)}` : ''}.`}>
      <div className="grid gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <p className="text-heading">Tus datos siguen guardados. Para seguir usando EDUGRID, contrata tu plan y lo activamos de inmediato.</p>
        <a href={contacto} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary no-underline hover:bg-primary-hover">
          Contactar para contratar
        </a>
        {cuenta.puedeSimularPrueba && cuenta.perfil?.tipo === 'administrador' && (
          <Button
            variant="secundario"
            onClick={() => cuentaApi.prueba(cuenta.token, 'reiniciar').then(actualizarCuenta, (e: unknown) => setError(e instanceof Error ? e.message : 'Error'))}
          >
            Solo pruebas: volver a 30 días
          </Button>
        )}
        {error && <Notice tone="peligro">{error}</Notice>}
        <Button variant="fantasma" onClick={logout}>Cerrar sesión</Button>
      </div>
    </AuthLayout>
  )
}

/** Aviso del tablero del administrador con los días de prueba que quedan. */
export function BannerPrueba() {
  const { cuenta, actualizarCuenta } = useStore()
  if (!cuenta || cuenta.escuela.diasRestantes === null || cuenta.perfil?.tipo !== 'administrador') return null
  const dias = cuenta.escuela.diasRestantes
  const progreso = Math.min(1, Math.max(0, (30 - dias) / 30))
  return (
    <div className={`mb-4 rounded-2xl border p-4 ${dias <= 5 ? 'border-warning/50 bg-warning-bg' : 'border-info/40 bg-info-bg'}`} role="status" data-banner-prueba>
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 font-semibold text-heading">
          Prueba gratis: {dias === 1 ? 'te queda 1 día' : `te quedan ${dias} días`}
          <span className="block text-sm font-normal text-muted">Termina el {cuenta.escuela.trialEndsAt ? formatDate(cuenta.escuela.trialEndsAt) : ''}. Tus datos se conservan al contratar.</span>
        </p>
        {cuenta.puedeSimularPrueba && (
          <Button variant="fantasma" onClick={() => void cuentaApi.prueba(cuenta.token, 'vencer').then(actualizarCuenta)}>
            Solo pruebas: terminar la prueba
          </Button>
        )}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface" aria-hidden="true">
        <div className="h-full rounded-full bg-primary" style={{ width: `${progreso * 100}%` }} />
      </div>
    </div>
  )
}
