import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button, Field, Input, LinkButton, Notice } from '../components/ui'
import { cuentaApi, hayServidor } from '../data/cuenta'
import { ROL_DE_PERFIL, type SesionPublica } from '../data/cuentaTipos'
import { HOME_BY_ROLE } from '../lib/permissions'
import { EMAIL_RE } from '../lib/profile'
import { useStore } from '../state/context'
import { AuthLayout, LigaDemo, PasswordInput } from './cuenta/AuthLayout'
import { ElegirPerfil } from './cuenta/ElegirPerfil'

type Paso = { tipo: 'entrar' } | { tipo: 'escuela'; opciones: { id: string; nombre: string }[] } | { tipo: 'perfil'; sesion: SesionPublica } | { tipo: 'recuperar' }

/** Inicio de sesión real con correo y contraseña. La demo queda aparte, en «Ver demo». */
export function Login() {
  const { entrarConCuenta, actualizarCuenta } = useStore()
  const navigate = useNavigate()
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [ver, setVer] = useState(false)
  const [paso, setPaso] = useState<Paso>({ tipo: 'entrar' })
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [recuperado, setRecuperado] = useState<{ mensaje: string; ligas: string[] } | null>(null)
  const servidor = hayServidor()

  const entrar = (s: SesionPublica) => {
    entrarConCuenta(s)
    navigate(s.perfil ? HOME_BY_ROLE[ROL_DE_PERFIL[s.perfil.tipo]] : '/', { replace: true })
  }

  const enviar = async (e: { preventDefault: () => void }, escuela?: string) => {
    e.preventDefault()
    setError('')
    if (!EMAIL_RE.test(correo.trim()) || !contrasena) return setError('Escribe tu correo y tu contraseña.')
    setOcupado(true)
    try {
      const r = await cuentaApi.iniciar(correo, contrasena, escuela)
      if ('elegir' in r) return setPaso({ tipo: 'escuela', opciones: r.elegir })
      if (r.sesion.perfiles.length > 1) return setPaso({ tipo: 'perfil', sesion: r.sesion })
      entrar(r.sesion)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.')
    } finally {
      setOcupado(false)
    }
  }

  const recuperar = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!EMAIL_RE.test(correo.trim())) return setError('Escribe el correo con el que entras.')
    setOcupado(true)
    try {
      const r = await cuentaApi.recuperar(correo)
      setRecuperado({ mensaje: r.mensaje, ligas: r.ligas ?? [] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la liga.')
    } finally {
      setOcupado(false)
    }
  }

  if (paso.tipo === 'perfil')
    return (
      <AuthLayout title={`Hola, ${paso.sesion.usuario.nombre.split(' ')[0]}`} subtitle={`Tu cuenta de ${paso.sesion.escuela.nombre} tiene varios perfiles. ¿Con cuál quieres entrar?`}>
        <ElegirPerfil
          perfiles={paso.sesion.perfiles}
          onElegir={async (id) => {
            const s = id === paso.sesion.perfil?.id ? paso.sesion : await cuentaApi.perfil(paso.sesion.token, id)
            actualizarCuenta(s)
            entrar(s)
          }}
        />
      </AuthLayout>
    )

  if (paso.tipo === 'escuela')
    return (
      <AuthLayout title="¿A qué escuela quieres entrar?" subtitle="Tu correo tiene cuenta en varias escuelas.">
        <form className="grid gap-3" onSubmit={(e) => e.preventDefault()}>
          {paso.opciones.map((o) => (
            <Button key={o.id} variant="secundario" disabled={ocupado} onClick={(e) => void enviar(e, o.id)} className="justify-start">
              {o.nombre}
            </Button>
          ))}
          {error && <Notice tone="peligro">{error}</Notice>}
          <Button variant="fantasma" onClick={() => setPaso({ tipo: 'entrar' })}>Volver</Button>
        </form>
      </AuthLayout>
    )

  if (paso.tipo === 'recuperar')
    return (
      <AuthLayout title="Recuperar contraseña" subtitle="Te mandamos una liga a tu correo para crear una contraseña nueva.">
        <form onSubmit={(e) => void recuperar(e)} className="grid gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm" noValidate>
          <Field label="Correo electrónico">{(id) => <Input id={id} type="email" inputMode="email" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />}</Field>
          {error && <Notice tone="peligro">{error}</Notice>}
          {recuperado && (
            <div role="status" className="grid gap-3">
              <Notice tone="exito" icon="check">{recuperado.mensaje}</Notice>
              {recuperado.ligas.map((l) => <LigaDemo key={l} liga={l} titulo="Liga para crear tu contraseña nueva" />)}
            </div>
          )}
          <Button type="submit" disabled={ocupado} icon="enviar">{ocupado ? 'Enviando…' : 'Enviar liga'}</Button>
          <Button variant="fantasma" onClick={() => { setPaso({ tipo: 'entrar' }); setRecuperado(null); setError('') }}>Volver a iniciar sesión</Button>
        </form>
      </AuthLayout>
    )

  return (
    <AuthLayout title="Inicia sesión" subtitle="Dirección, docentes, familias y alumnos en un solo lugar.">
      {servidor ? (
        <form onSubmit={(e) => void enviar(e)} className="grid gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm" noValidate>
          <Field label="Correo electrónico">{(id) => <Input id={id} type="email" inputMode="email" autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)} />}</Field>
          <Field label="Contraseña">{(id) => <PasswordInput id={id} value={contrasena} onChange={setContrasena} autoComplete="current-password" show={ver} onToggle={() => setVer(!ver)} />}</Field>
          {error && <div role="alert"><Notice tone="peligro">{error}</Notice></div>}
          <Button type="submit" disabled={ocupado}>{ocupado ? 'Entrando…' : 'Entrar'}</Button>
          <button type="button" className="min-h-11 text-sm font-semibold text-link underline" onClick={() => { setPaso({ tipo: 'recuperar' }); setError('') }}>
            Olvidé mi contraseña
          </button>
        </form>
      ) : (
        <Notice tone="info">Esta copia de EDUGRID no tiene servidor (por ejemplo, GitHub Pages): aquí solo está la demo. Para entrar con tu cuenta usa la dirección de tu escuela.</Notice>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {servidor && (
          <LinkButton to="/registro-escuela" variant="secundario" icon="mas" className="w-full">
            Registrar mi escuela
          </LinkButton>
        )}
        <LinkButton to="/demo" variant="secundario" icon="ojo" className={`w-full ${servidor ? '' : 'sm:col-span-2'}`}>
          Ver demo
        </LinkButton>
      </div>
      <p className="mt-3 text-center text-sm text-muted">
        {servidor ? '30 días de prueba gratis, sin tarjeta. ' : ''}«Ver demo» abre el Colegio Demo con datos ficticios (DEMO), sin contraseña.{' '}
        <Link to="/privacidad" className="font-semibold text-link underline">Privacidad</Link>
      </p>
    </AuthLayout>
  )
}
