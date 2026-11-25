import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button, Field, Notice } from '../../components/ui'
import { cuentaApi } from '../../data/cuenta'
import { CONTRASENA_MINIMA, ROL_DE_PERFIL } from '../../data/cuentaTipos'
import { HOME_BY_ROLE } from '../../lib/permissions'
import { useStore } from '../../state/context'
import { AuthLayout, PasswordInput } from './AuthLayout'

/** Con la liga de «Olvidé mi contraseña»: crea una nueva y entra. Las demás sesiones se cierran. */
export function Restablecer() {
  const { token = '' } = useParams()
  const { entrarConCuenta } = useStore()
  const navigate = useNavigate()
  const [contrasena, setContrasena] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [ver, setVer] = useState(false)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (contrasena.length < CONTRASENA_MINIMA) return setError(`La contraseña debe tener al menos ${CONTRASENA_MINIMA} caracteres.`)
    if (contrasena !== confirmacion) return setError('Las contraseñas no coinciden.')
    setOcupado(true)
    try {
      const s = await cuentaApi.restablecer(token, contrasena)
      entrarConCuenta(s, 'Creó una contraseña nueva')
      navigate(s.perfil ? HOME_BY_ROLE[ROL_DE_PERFIL[s.perfil.tipo]] : '/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.')
      setOcupado(false)
    }
  }

  return (
    <AuthLayout title="Crea una contraseña nueva" subtitle="Por seguridad, se cierran las sesiones abiertas en otros dispositivos.">
      <form onSubmit={(e) => void enviar(e)} className="grid gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm" noValidate>
        <Field label="Contraseña nueva" hint={`Al menos ${CONTRASENA_MINIMA} caracteres.`}>{(id) => <PasswordInput id={id} value={contrasena} onChange={setContrasena} autoComplete="new-password" show={ver} onToggle={() => setVer(!ver)} />}</Field>
        <Field label="Confirma la contraseña">{(id) => <PasswordInput id={id} value={confirmacion} onChange={setConfirmacion} autoComplete="new-password" show={ver} onToggle={() => setVer(!ver)} />}</Field>
        {error && <div role="alert"><Notice tone="peligro">{error}</Notice></div>}
        <Button type="submit" disabled={ocupado} icon="check">{ocupado ? 'Guardando…' : 'Guardar y entrar'}</Button>
        <Link to="/" className="text-center text-sm font-semibold text-link underline">Volver a iniciar sesión</Link>
      </form>
    </AuthLayout>
  )
}
