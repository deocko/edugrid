import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button, Field, LoadingState, Notice } from '../../components/ui'
import { cuentaApi } from '../../data/cuenta'
import { CONTRASENA_MINIMA, NOMBRE_PERFIL, ROL_DE_PERFIL, type InvitacionPublica } from '../../data/cuentaTipos'
import { HOME_BY_ROLE } from '../../lib/permissions'
import { useStore } from '../../state/context'
import { AuthLayout, PasswordInput } from './AuthLayout'

/** La persona abre la liga de su invitación, ve su escuela, crea su contraseña y entra. */
export function Invitacion() {
  const { token = '' } = useParams()
  const { entrarConCuenta } = useStore()
  const navigate = useNavigate()
  const [inv, setInv] = useState<InvitacionPublica | null>(null)
  const [cargaError, setCargaError] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [ver, setVer] = useState(false)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    cuentaApi.invitacion(token).then(setInv, (e: unknown) => setCargaError(e instanceof Error ? e.message : 'No se pudo abrir la invitación.'))
  }, [token])

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!inv) return
    if (!inv.cuentaActiva) {
      if (contrasena.length < CONTRASENA_MINIMA) return setError(`La contraseña debe tener al menos ${CONTRASENA_MINIMA} caracteres.`)
      if (contrasena !== confirmacion) return setError('Las contraseñas no coinciden.')
    } else if (!contrasena) return setError('Escribe tu contraseña.')
    setOcupado(true)
    try {
      const s = await cuentaApi.aceptar(token, contrasena)
      entrarConCuenta(s, 'Aceptó su invitación')
      navigate(s.perfil ? HOME_BY_ROLE[ROL_DE_PERFIL[s.perfil.tipo]] : '/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aceptar la invitación.')
      setOcupado(false)
    }
  }

  if (cargaError)
    return (
      <AuthLayout title="Invitación">
        <Notice tone="peligro">{cargaError}</Notice>
        <p className="mt-4 text-sm"><Link to="/" className="font-semibold text-link underline">Ir a iniciar sesión</Link></p>
      </AuthLayout>
    )
  if (!inv) return <LoadingState label="Abriendo tu invitación…" />

  const perfil = NOMBRE_PERFIL[inv.tipo].toLowerCase()
  return (
    <AuthLayout title={`Te invitan a ${inv.escuela}`} subtitle={<>Hola, <strong className="text-white">{inv.nombre}</strong>. La escuela te dio de alta con el perfil de <strong className="text-white">{perfil}</strong>.</>}>
      {inv.estado !== 'vigente' ? (
        <div className="grid gap-3">
          <Notice tone="aviso">{inv.estado === 'usada' ? 'Esta invitación ya se usó. Entra con tu correo y contraseña.' : 'Esta invitación ya venció. Pide a la escuela que te la envíe de nuevo.'}</Notice>
          <Link to="/" className="font-semibold text-link underline">Ir a iniciar sesión</Link>
        </div>
      ) : (
        <form onSubmit={(e) => void enviar(e)} className="grid gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm" noValidate>
          <p className="text-sm text-muted">
            Tu correo: <strong className="break-all text-heading">{inv.correo}</strong>
          </p>
          {inv.cuentaActiva ? (
            <>
              <Notice tone="info">Ya tienes cuenta en {inv.escuela} con este correo. Escribe tu contraseña y el perfil de {perfil} se agrega a tu cuenta.</Notice>
              <Field label="Tu contraseña">{(id) => <PasswordInput id={id} value={contrasena} onChange={setContrasena} autoComplete="current-password" show={ver} onToggle={() => setVer(!ver)} />}</Field>
            </>
          ) : (
            <>
              <Field label="Crea tu contraseña" hint={`Al menos ${CONTRASENA_MINIMA} caracteres.`}>{(id) => <PasswordInput id={id} value={contrasena} onChange={setContrasena} autoComplete="new-password" show={ver} onToggle={() => setVer(!ver)} />}</Field>
              <Field label="Confirma tu contraseña">{(id) => <PasswordInput id={id} value={confirmacion} onChange={setConfirmacion} autoComplete="new-password" show={ver} onToggle={() => setVer(!ver)} />}</Field>
            </>
          )}
          {error && <div role="alert"><Notice tone="peligro">{error}</Notice></div>}
          <Button type="submit" disabled={ocupado} icon="check">{ocupado ? 'Entrando…' : inv.cuentaActiva ? 'Agregar perfil y entrar' : 'Crear contraseña y entrar'}</Button>
        </form>
      )}
    </AuthLayout>
  )
}
