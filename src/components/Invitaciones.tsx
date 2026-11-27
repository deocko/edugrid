import { useCallback, useEffect, useState } from 'react'
import { cuentaApi } from '../data/cuenta'
import { NOMBRE_PERFIL, type InvitacionAdmin, type ResultadoInvitacion, type TipoPerfil } from '../data/cuentaTipos'
import { alCambiarInvitaciones, avisarInvitaciones } from '../lib/invitar'
import { formatDate, plural } from '../lib/format'
import { useApp } from '../state/context'
import { ListaInvitaciones } from './ImportarExcel'
import { Badge, Button, Card, Notice, Table, TD, TH } from './ui'

const ESTADO: Record<InvitacionAdmin['estado'], { texto: string; tono: 'aviso' | 'exito' | 'peligro' }> = {
  pendiente: { texto: 'Pendiente', tono: 'aviso' },
  aceptada: { texto: 'Aceptada', tono: 'exito' },
  expirada: { texto: 'Expirada', tono: 'peligro' },
}

/**
 * Invitaciones de la escuela leídas de la API. Se vuelven a leer al enviar o reenviar
 * una invitación y al regresar a la pestaña (así se ve «Aceptada» cuando la persona
 * crea su contraseña en otro dispositivo).
 */
function useInvitaciones() {
  const { cuenta, session } = useApp()
  const token = session.role === 'admin' ? cuenta?.token : undefined
  const [lista, setLista] = useState<InvitacionAdmin[] | null>(null)
  const [error, setError] = useState('')
  const leer = useCallback(() => {
    if (!token) return
    cuentaApi
      .invitaciones(token)
      .then((r) => {
        setLista(r.invitaciones)
        setError('')
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'No se pudieron leer las invitaciones.'))
  }, [token])
  useEffect(() => {
    leer()
    const alVolver = () => document.visibilityState === 'visible' && leer()
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', leer)
    const quitar = alCambiarInvitaciones(leer)
    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', leer)
      quitar()
    }
  }, [leer])
  return { token, lista, error }
}

const MAXIMO = 50

/** Lista de invitaciones de un módulo (Alumnos, Docentes o Familias) con su estado. Solo con cuenta real. */
export function InvitacionesModulo({ tipo }: { tipo: TipoPerfil }) {
  const { token, lista, error } = useInvitaciones()
  const [todas, setTodas] = useState(false)
  const [reenviando, setReenviando] = useState('')
  const [reenvio, setReenvio] = useState<ResultadoInvitacion | null>(null)
  const [errorReenvio, setErrorReenvio] = useState('')
  if (!token) return null
  const delModulo = (lista ?? []).filter((i) => i.perfiles.some((p) => p.tipo === tipo))
  const visibles = todas ? delModulo : delModulo.slice(0, MAXIMO)
  const cuenta = (e: InvitacionAdmin['estado']) => delModulo.filter((i) => i.estado === e).length
  const nombre = NOMBRE_PERFIL[tipo].toLowerCase()

  const reenviar = async (i: InvitacionAdmin) => {
    setReenviando(i.id)
    setReenvio(null)
    setErrorReenvio('')
    try {
      setReenvio((await cuentaApi.reenviar(token, i.id)).resultado)
      avisarInvitaciones()
    } catch (e) {
      setErrorReenvio(e instanceof Error ? e.message : 'No se pudo reenviar la invitación.')
    } finally {
      setReenviando('')
    }
  }

  return (
    <Card title="Invitaciones" className="mt-4">
      <div data-invitaciones-modulo={tipo}>
        {error && <Notice tone="peligro">{error}</Notice>}
        {lista === null && !error && <p className="text-sm text-muted">Cargando invitaciones…</p>}
        {lista !== null && delModulo.length === 0 && (
          <p className="text-sm text-muted">Aún no hay invitaciones con perfil de {nombre}. Cuando registres o importes a alguien con correo, su invitación aparecerá aquí con su estado.</p>
        )}
        {delModulo.length > 0 && (
          <>
            <p className="mb-2 text-sm text-muted">
              {plural(cuenta('pendiente'), 'pendiente', 'pendientes')} · {plural(cuenta('aceptada'), 'aceptada', 'aceptadas')} · {plural(cuenta('expirada'), 'expirada', 'expiradas')}. Cada correo tiene una sola invitación, aunque tenga varios perfiles.
            </p>
            {reenvio && <div className="mb-3"><ListaInvitaciones resultados={[reenvio]} /></div>}
            {errorReenvio && <div className="mb-3"><Notice tone="peligro">{errorReenvio}</Notice></div>}
            <Table caption={`Invitaciones con perfil de ${nombre}`}>
              <thead>
                <tr>
                  <th className={TH}>Persona</th>
                  <th className={`${TH} hidden sm:table-cell`}>Perfiles</th>
                  <th className={TH}>Estado</th>
                  <th className={`${TH} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((i) => (
                  <tr key={i.id} data-invitacion={i.correo} data-estado={i.estado}>
                    <td className={TD}>
                      <p className="font-semibold text-heading">{i.nombre}</p>
                      <p className="max-w-[16rem] truncate text-xs text-muted sm:max-w-xs" title={i.correo}>{i.correo}</p>
                    </td>
                    <td className={`${TD} hidden text-sm sm:table-cell`}>
                      {[...new Set(i.perfiles.map((p) => p.tipo))].map((t) => `${NOMBRE_PERFIL[t]}${i.perfiles.filter((p) => p.tipo === t).length > 1 ? ` (${i.perfiles.filter((p) => p.tipo === t).length})` : ''}`).join(' · ')}
                    </td>
                    <td className={TD}>
                      <Badge tone={ESTADO[i.estado].tono}>{ESTADO[i.estado].texto}</Badge>
                      <p className="mt-1 text-xs text-muted">
                        {i.estado === 'aceptada' && i.aceptadaAt ? `El ${formatDate(i.aceptadaAt)}` : i.estado === 'pendiente' ? `Vence el ${formatDate(i.expiraAt)}` : `Venció el ${formatDate(i.expiraAt)}`}
                      </p>
                    </td>
                    <td className={`${TD} text-right`}>
                      {i.estado === 'aceptada' ? (
                        <span className="text-xs text-muted">Ya entra con su cuenta</span>
                      ) : (
                        <Button variant="fantasma" icon="enviar" disabled={reenviando === i.id} onClick={() => void reenviar(i)} aria-label={`Reenviar la invitación de ${i.nombre}`}>
                          {reenviando === i.id ? 'Enviando…' : 'Reenviar'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {delModulo.length > MAXIMO && (
              <Button variant="fantasma" className="mt-2" onClick={() => setTodas(!todas)}>
                {todas ? 'Ver menos' : `Ver las ${delModulo.length} invitaciones`}
              </Button>
            )}
          </>
        )}
      </div>
    </Card>
  )
}
