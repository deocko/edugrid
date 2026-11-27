import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { BotonPlantilla, VistaPrevia, type Reporte } from '../../components/ImportarExcel'
import { Button, Field, FilePickButton, Input, Notice } from '../../components/ui'
import { ApiRepository, apiUrl } from '../../data/apiAdapter'
import { cuentaApi, hayServidor } from '../../data/cuenta'
import { CONTRASENA_MINIMA } from '../../data/cuentaTipos'
import { datosEscuelaNueva } from '../../data/escuelaNueva'
import type { Level } from '../../data/types'
import { plural } from '../../lib/format'
import { leerExcel, NOMBRE_TIPO, planear, revisar, type FilaRevisada, type Lectura, type TipoImportacion } from '../../lib/importar'
import { enviarInvitaciones } from '../../lib/invitar'
import { EMAIL_RE } from '../../lib/profile'
import { LEVEL_LABEL, LEVELS } from '../../lib/scope'
import { useStore } from '../../state/context'
import { AuthLayout, PasswordInput } from './AuthLayout'

const PASOS = ['Escuela', 'Administrador', 'Cargar datos', 'Resumen'] as const
const TIPOS: TipoImportacion[] = ['alumnos', 'docentes', 'familias']

/** Avance visible del wizard: 4 pasos. */
function Avance({ paso }: { paso: number }) {
  return (
    <ol className="mb-5 grid grid-cols-4 gap-2" aria-label="Avance del registro">
      {PASOS.map((p, i) => (
        <li key={p} className="min-w-0" aria-current={i === paso ? 'step' : undefined}>
          <span className={`block h-1.5 rounded-full ${i <= paso ? 'bg-primary' : 'bg-line'}`} />
          <span className={`mt-1 block truncate text-xs ${i === paso ? 'font-bold text-heading' : 'text-muted'}`}>
            {i + 1}
            {/* En el celular solo el paso actual lleva nombre, para que no se corte. */}
            <span className={i === paso ? '' : 'sr-only sm:not-sr-only'}>. {p}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/**
 * Alta de escuela (ruta pública /registro-escuela): 1 Escuela, 2 Administrador,
 * 3 Cargar datos desde Excel (opcional) y 4 Resumen y crear. Al crear, la escuela
 * queda con 30 días de prueba y el administrador entra directo a su tablero.
 */
export function RegistroEscuela() {
  const { entrarConCuenta } = useStore()
  const navigate = useNavigate()
  const [paso, setPaso] = useState(0)
  const [escuela, setEscuela] = useState({ nombre: '', niveles: [] as Level[], correoContacto: '' })
  const [admin, setAdmin] = useState({ nombre: '', correo: '', contrasena: '', confirmacion: '' })
  const [ver, setVer] = useState(false)
  const [tipo, setTipo] = useState<TipoImportacion>('alumnos')
  const [lectura, setLectura] = useState<Lectura | null>(null)
  const [consentimiento, setConsentimiento] = useState(false)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  // Vista previa contra una escuela vacía con los niveles elegidos (así se revisan grados y correos repetidos).
  const vacia = useMemo(
    () => datosEscuelaNueva({ id: 'nueva', nombre: escuela.nombre, niveles: escuela.niveles, correoContacto: escuela.correoContacto, admin: { id: 'adm', nombre: admin.nombre, correo: admin.correo }, hoy: new Date() }),
    [escuela, admin.nombre, admin.correo],
  )
  const filas: FilaRevisada[] | null = useMemo(() => (lectura ? revisar(vacia, tipo, lectura) : null), [lectura, vacia, tipo])
  const validas = filas?.filter((f) => !f.ejemplo && !f.errores.length).length ?? 0

  const siguiente = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (paso === 0) {
      if (escuela.nombre.trim().length < 3) return setError('Escribe el nombre de la escuela.')
      if (escuela.niveles.length === 0) return setError('Elige al menos un nivel.')
      if (!EMAIL_RE.test(escuela.correoContacto.trim())) return setError('Escribe un correo de contacto válido.')
    }
    if (paso === 1) {
      if (admin.nombre.trim().length < 3) return setError('Escribe tu nombre.')
      if (!EMAIL_RE.test(admin.correo.trim())) return setError('Escribe un correo válido: con él vas a entrar.')
      if (admin.contrasena.length < CONTRASENA_MINIMA) return setError(`La contraseña debe tener al menos ${CONTRASENA_MINIMA} caracteres.`)
      if (admin.contrasena !== admin.confirmacion) return setError('Las contraseñas no coinciden.')
    }
    if (paso === 2 && lectura && validas > 0 && tipo === 'alumnos' && !consentimiento) return setError('Marca el consentimiento de las familias para registrar a los alumnos.')
    setPaso(paso + 1)
  }

  const crear = async () => {
    setError('')
    setOcupado(true)
    try {
      const sesion = await cuentaApi.registrar({ escuela: { ...escuela, nombre: escuela.nombre.trim() }, admin: { nombre: admin.nombre.trim(), correo: admin.correo.trim(), contrasena: admin.contrasena } })
      let reporte: Reporte | null = null
      if (lectura && validas > 0) {
        // Importa con la escuela ya creada (sus datos reales) y luego manda las invitaciones.
        const repo = new ApiRepository(apiUrl(), 0, sesion.token)
        const db = await repo.snapshot()
        const revisadas = revisar(db, tipo, lectura)
        const plan = planear(db, tipo, revisadas, { demo: false })
        await plan.aplicar(repo)
        await repo.confirmar()
        reporte = { importadas: plan.importadas, gruposNuevos: [...new Set(revisadas.filter((f) => !f.ejemplo && !f.errores.length && f.grupoNuevo).map((f) => f.grupoNuevo!))], rechazadas: revisadas.filter((f) => !f.ejemplo && f.errores.length), sinCorreo: plan.sinCorreo, invitaciones: [] }
        try {
          reporte.invitaciones = await enviarInvitaciones(sesion.token, plan.invitaciones)
        } catch (e) {
          reporte.errorInvitaciones = e instanceof Error ? e.message : 'Error desconocido'
        }
      }
      entrarConCuenta(sesion, 'Dio de alta la escuela')
      navigate('/admin', { replace: true, state: reporte ? { importacion: { tipo, reporte } } : null })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la escuela.')
      setOcupado(false)
    }
  }

  if (!hayServidor())
    return (
      <AuthLayout title="Registra tu escuela">
        <Notice tone="info">Esta copia de EDUGRID no tiene servidor (por ejemplo, GitHub Pages). Para dar de alta tu escuela, usa la dirección de EDUGRID en Vercel.</Notice>
      </AuthLayout>
    )

  return (
    <AuthLayout title="Registra tu escuela" subtitle="4 pasos y listo: 30 días de prueba gratis, sin tarjeta." wide>
      <Avance paso={paso} />
      <form onSubmit={paso < 3 ? siguiente : (e) => (e.preventDefault(), void crear())} className="grid gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm" noValidate>
        <h2 className="text-lg font-bold text-heading">Paso {paso + 1} de 4 · {PASOS[paso]}</h2>

        {paso === 0 && (
          <>
            <Field label="Nombre de la escuela">{(id) => <Input id={id} value={escuela.nombre} onChange={(e) => setEscuela({ ...escuela, nombre: e.target.value })} autoComplete="organization" />}</Field>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-heading">Niveles que atiende</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {LEVELS.map((l) => (
                  <label key={l} className="flex min-h-11 items-center gap-2 rounded-xl border border-line px-3">
                    <input
                      type="checkbox"
                      className="size-5 accent-[var(--c-primary)]"
                      checked={escuela.niveles.includes(l)}
                      onChange={(e) => setEscuela({ ...escuela, niveles: e.target.checked ? [...escuela.niveles, l] : escuela.niveles.filter((x) => x !== l) })}
                    />
                    {LEVEL_LABEL[l]}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Correo de contacto de la escuela">{(id) => <Input id={id} type="email" inputMode="email" value={escuela.correoContacto} onChange={(e) => setEscuela({ ...escuela, correoContacto: e.target.value })} autoComplete="email" />}</Field>
          </>
        )}

        {paso === 1 && (
          <>
            <p className="text-sm text-muted">Esta es la cuenta de dirección: con ella entras y das de alta a docentes, familias y alumnos.</p>
            <Field label="Tu nombre">{(id) => <Input id={id} value={admin.nombre} onChange={(e) => setAdmin({ ...admin, nombre: e.target.value })} autoComplete="name" />}</Field>
            <Field label="Tu correo">{(id) => <Input id={id} type="email" inputMode="email" value={admin.correo} onChange={(e) => setAdmin({ ...admin, correo: e.target.value })} autoComplete="username" />}</Field>
            <Field label="Contraseña" hint={`Al menos ${CONTRASENA_MINIMA} caracteres.`}>{(id) => <PasswordInput id={id} value={admin.contrasena} onChange={(v) => setAdmin({ ...admin, contrasena: v })} autoComplete="new-password" show={ver} onToggle={() => setVer(!ver)} />}</Field>
            <Field label="Confirma la contraseña">{(id) => <PasswordInput id={id} value={admin.confirmacion} onChange={(v) => setAdmin({ ...admin, confirmacion: v })} autoComplete="new-password" show={ver} onToggle={() => setVer(!ver)} />}</Field>
          </>
        )}

        {paso === 2 && (
          <>
            <p className="text-sm text-muted">Opcional: sube tu lista desde Excel. Cada persona con correo recibe una invitación. También lo puedes hacer después desde Alumnos, Docentes o Familias.</p>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-heading">¿Qué vas a cargar?</legend>
              <div className="flex flex-wrap gap-2">
                {TIPOS.map((t) => (
                  <label key={t} className="flex min-h-11 items-center gap-2 rounded-xl border border-line px-3">
                    <input type="radio" name="tipo" className="size-5 accent-[var(--c-primary)]" checked={tipo === t} onChange={() => { setTipo(t); setLectura(null) }} />
                    {NOMBRE_TIPO[t].plural[0]!.toUpperCase() + NOMBRE_TIPO[t].plural.slice(1)}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap gap-2">
              <BotonPlantilla tipo={tipo} />
              <FilePickButton icon="subir" accept=".xlsx,.xls,.csv" onFile={(f) => void leerExcel(tipo, f).then((l) => { setLectura(l); setError(l.errores.join(' ')) })}>
                Subir Excel
              </FilePickButton>
            </div>
            {filas && filas.length > 0 && <VistaPrevia filas={filas} />}
            {filas && tipo === 'alumnos' && validas > 0 && (
              <label className="flex min-h-11 items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1 size-4" checked={consentimiento} onChange={(e) => setConsentimiento(e.target.checked)} />
                <span>La escuela tiene el consentimiento de las madres, padres o tutores para registrar a estos menores (aviso de privacidad).</span>
              </label>
            )}
          </>
        )}

        {paso === 3 && (
          <dl className="grid gap-3 text-sm">
            <div><dt className="text-muted">Escuela</dt><dd className="font-semibold text-heading">{escuela.nombre}</dd></div>
            <div><dt className="text-muted">Niveles</dt><dd className="font-semibold text-heading">{LEVELS.filter((l) => escuela.niveles.includes(l)).map((l) => LEVEL_LABEL[l]).join(', ')}</dd></div>
            <div><dt className="text-muted">Contacto</dt><dd className="font-semibold break-all text-heading">{escuela.correoContacto}</dd></div>
            <div><dt className="text-muted">Administrador</dt><dd className="font-semibold break-all text-heading">{admin.nombre} · {admin.correo}</dd></div>
            <div><dt className="text-muted">Datos desde Excel</dt><dd className="font-semibold text-heading">{lectura && validas ? `${plural(validas, NOMBRE_TIPO[tipo].singular, NOMBRE_TIPO[tipo].plural)} para importar` : 'Lo hago después'}</dd></div>
            <div><dt className="text-muted">Prueba gratis</dt><dd className="font-semibold text-heading">30 días a partir de hoy</dd></div>
          </dl>
        )}

        {error && <div role="alert"><Notice tone="peligro">{error}</Notice></div>}

        <div className="flex flex-wrap justify-between gap-2">
          {paso > 0 ? <Button variant="secundario" disabled={ocupado} onClick={() => { setError(''); setPaso(paso - 1) }}>Atrás</Button> : <span />}
          <div className="flex flex-wrap gap-2">
            {paso === 2 && <Button variant="fantasma" onClick={() => { setLectura(null); setError(''); setPaso(3) }}>Lo hago después</Button>}
            <Button type="submit" disabled={ocupado} icon={paso === 3 ? 'check' : 'derecha'}>
              {paso === 3 ? (ocupado ? 'Creando tu escuela…' : 'Crear mi escuela') : 'Siguiente'}
            </Button>
          </div>
        </div>
      </form>
    </AuthLayout>
  )
}
