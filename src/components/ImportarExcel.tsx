import { useState } from 'react'
import { NOMBRE_PERFIL, type ResultadoInvitacion } from '../data/cuentaTipos'
import { enviarInvitaciones } from '../lib/invitar'
import { saveFile } from '../lib/env'
import { plural } from '../lib/format'
import { leerExcel, NOMBRE_TIPO, planear, plantilla, revisar, type FilaRevisada, type TipoImportacion } from '../lib/importar'
import { useApp } from '../state/context'
import { Badge, Button, FilePickButton, Modal, Notice } from './ui'

const ESTADO: Record<ResultadoInvitacion['estado'], { texto: string; tono: 'exito' | 'aviso' | 'peligro' | 'info' }> = {
  enviada: { texto: 'Invitación enviada', tono: 'exito' },
  'no-enviada': { texto: 'Invitación creada', tono: 'aviso' },
  reutilizada: { texto: 'Misma invitación', tono: 'info' },
  'ya-tiene-perfil': { texto: 'Ya tiene cuenta', tono: 'info' },
  error: { texto: 'No se invitó', tono: 'peligro' },
}

/** Lista de invitaciones con su estado y, en modo demo, la liga para probar. */
export function ListaInvitaciones({ resultados }: { resultados: ResultadoInvitacion[] }) {
  if (resultados.length === 0) return null
  const conLiga = resultados.some((r) => r.liga)
  return (
    <div className="grid gap-2" data-invitaciones>
      <p className="text-sm font-bold text-heading">Invitaciones por correo</p>
      {conLiga && <Notice tone="aviso">Modo demo: los correos no se envían. Abre cada liga para crear la contraseña de esa persona.</Notice>}
      <ul className="grid gap-2">
        {resultados.map((r) => (
          <li key={`${r.tipo}-${r.referencia}-${r.correo}`} className="rounded-xl border border-line bg-surface p-3 text-sm">
            <span className="flex flex-wrap items-center gap-2">
              <strong className="text-heading">{r.nombre || r.correo}</strong>
              <span className="min-w-0 text-muted">· {NOMBRE_PERFIL[r.tipo]} · <span className="inline-block max-w-full truncate align-bottom" title={r.correo}>{r.correo}</span></span>
              <Badge tone={ESTADO[r.estado].tono}>{ESTADO[r.estado].texto}</Badge>
            </span>
            {r.motivo && r.estado !== 'no-enviada' && <span className="mt-1 block text-xs text-muted">{r.motivo}</span>}
            {r.liga && (
              <a href={`#${r.liga.split('#')[1] ?? ''}`} className="mt-1 block text-xs font-semibold break-all text-link underline" data-liga-invitacion={r.correo}>
                {r.liga}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export interface Reporte {
  importadas: number
  /** Familias que ya existían con ese correo: se reutilizaron, no se duplicaron. */
  reutilizadas?: number
  /** Grupos que se crearon porque no existían (avisados en la vista previa). */
  gruposNuevos?: string[]
  rechazadas: FilaRevisada[]
  sinCorreo: FilaRevisada[]
  invitaciones: ResultadoInvitacion[]
  errorInvitaciones?: string
}

/** Resumen después de importar: cuántas entraron y cuáles se rechazaron con su motivo. */
export function ReporteImportacion({ tipo, reporte }: { tipo: TipoImportacion; reporte: Reporte }) {
  const n = NOMBRE_TIPO[tipo]
  return (
    <div className="grid gap-3" role="status" data-reporte-importacion>
      <Notice tone="exito" icon="check">
        {reporte.importadas === 1 ? 'Entró' : 'Entraron'} {plural(reporte.importadas, n.singular, n.plural)}.{reporte.rechazadas.length === 1 ? ' Se rechazó 1 fila.' : reporte.rechazadas.length ? ` Se rechazaron ${reporte.rechazadas.length} filas.` : ''}
      </Notice>
      {!!reporte.reutilizadas && (
        <Notice tone="info">{plural(reporte.reutilizadas, 'familia ya existía', 'familias ya existían')} con ese correo: se {reporte.reutilizadas === 1 ? 'reutilizó' : 'reutilizaron'} sin duplicarlas y conservan su misma invitación.</Notice>
      )}
      {!!reporte.gruposNuevos?.length && (
        <Notice tone="info">Se {reporte.gruposNuevos.length === 1 ? 'creó el grupo' : 'crearon los grupos'} {reporte.gruposNuevos.join(', ')}. Ya aparece{reporte.gruposNuevos.length === 1 ? '' : 'n'} en Ciclos y grupos y en el conteo del tablero.</Notice>
      )}
      {reporte.rechazadas.length > 0 && (
        <div className="rounded-xl border border-danger/40 bg-danger-bg p-3 text-sm text-danger">
          <p className="font-bold">Filas rechazadas</p>
          <ul className="mt-1 list-disc pl-5">
            {reporte.rechazadas.map((f) => (
              <li key={f.numero}>Fila {f.numero}{f.nombre ? ` (${f.nombre})` : ''}: {f.errores.join(' ')}</li>
            ))}
          </ul>
        </div>
      )}
      {reporte.sinCorreo.length > 0 && (
        <Notice tone="info">
          {plural(reporte.sinCorreo.length, 'registro quedó', 'registros quedaron')} sin cuenta porque no tienen correo: invítalos después desde su ficha.
          <span className="mt-1 block text-xs">{reporte.sinCorreo.map((f) => f.nombre).join(', ')}</span>
        </Notice>
      )}
      {reporte.errorInvitaciones && <Notice tone="peligro">No se pudieron crear las invitaciones: {reporte.errorInvitaciones}</Notice>}
      <ListaInvitaciones resultados={reporte.invitaciones} />
    </div>
  )
}

/** Vista previa fila por fila, con los errores marcados ANTES de confirmar. */
export function VistaPrevia({ filas }: { filas: FilaRevisada[] }) {
  const reales = filas.filter((f) => !f.ejemplo)
  const malas = reales.filter((f) => f.errores.length)
  const ejemplos = filas.length - reales.length
  // Grupos (y grados) que todavía no existen: se avisan ANTES de confirmar, nunca se crean en silencio.
  const gruposNuevos = [...new Set(reales.filter((f) => !f.errores.length && f.grupoNuevo).map((f) => f.grupoNuevo!))]
  return (
    <div className="grid gap-3">
      {gruposNuevos.length > 0 && (
        <div data-grupos-nuevos>
          <Notice tone="aviso">
            La importación creará {gruposNuevos.length === 1 ? 'el grupo' : 'los grupos'} <strong>{gruposNuevos.join(', ')}</strong> porque todavía no {gruposNuevos.length === 1 ? 'existe' : 'existen'} en el ciclo actual.
            Si es un error, corrige la columna «Grupo» del Excel antes de importar.
          </Notice>
        </div>
      )}
      <p className="text-sm text-muted" data-resumen-vista-previa>
        {plural(reales.length - malas.length, 'fila lista', 'filas listas')} para importar
        {malas.length ? ` · ${plural(malas.length, 'fila con errores', 'filas con errores')} (no se importan)` : ''}
        {ejemplos ? ` · ${plural(ejemplos, 'fila de ejemplo omitida', 'filas de ejemplo omitidas')}` : ''}
      </p>
      <div className="max-h-[50vh] overflow-auto rounded-xl border border-line">
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">Vista previa de la importación</caption>
          <thead className="sticky top-0 bg-surface-2">
            <tr>
              <th className="w-12 px-3 py-2 text-left text-xs font-bold text-muted">Fila</th>
              <th className="px-3 py-2 text-left text-xs font-bold text-muted">Nombre</th>
              <th className="w-[38%] px-3 py-2 text-left text-xs font-bold text-muted">Revisión</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.numero} className="border-t border-line align-top" data-fila={f.numero} data-estado={f.ejemplo ? 'ejemplo' : f.errores.length ? 'error' : 'lista'}>
                <td className="px-3 py-2 text-muted">{f.numero}</td>
                <td className="px-3 py-2 text-heading">
                  <span className="block">{f.nombre || '—'}</span>
                  {/* Correos sin cortes a mitad de palabra: si no cabe, «…» y completo al pasar el cursor. */}
                  {f.datos.correo && (
                    <span className="block truncate text-xs text-muted" title={f.datos.correo} data-correo-vista-previa>
                      {f.datos.correo}
                    </span>
                  )}
                  {f.datos.tutorCorreo && (
                    <span className="block truncate text-xs text-muted" title={`Tutor: ${f.datos.tutorCorreo}`} data-correo-vista-previa>
                      Tutor: {f.datos.tutorCorreo}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {f.ejemplo ? (
                    <Badge>Ejemplo: se omite</Badge>
                  ) : f.errores.length ? (
                    <span className="grid gap-1 text-danger">
                      <Badge tone="peligro">No se importa</Badge>
                      {f.errores.map((e) => <span key={e} className="text-xs">{e}</span>)}
                    </span>
                  ) : (
                    <span className="grid gap-1">
                      <Badge tone="exito">Lista</Badge>
                      {f.aviso && <span className="text-xs text-muted">{f.aviso}</span>}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Botón para bajar la plantilla de Excel de ese tipo. */
export function BotonPlantilla({ tipo }: { tipo: TipoImportacion }) {
  const [aviso, setAviso] = useState('')
  return (
    <>
      <Button
        variant="secundario"
        icon="descargar"
        onClick={() => {
          setAviso('')
          void plantilla(tipo)
            .then((b) => saveFile(b, `plantilla-${tipo}-edugrid.xlsx`))
            .then((r) => r === 'no-disponible' && setAviso('Este navegador no permite descargar archivos aquí. Abre EDUGRID en una pestaña normal.'))
        }}
      >
        Descargar plantilla
      </Button>
      {aviso && <Notice tone="aviso">{aviso}</Notice>}
    </>
  )
}

/** «Descargar plantilla» + «Importar Excel» de Alumnos, Docentes y Familias (el mismo importador en los 3). */
export function ImportarExcel({ tipo }: { tipo: TipoImportacion }) {
  const { db, act, esDemo, cuenta } = useApp()
  const [filas, setFilas] = useState<FilaRevisada[] | null>(null)
  const [error, setError] = useState('')
  const [consentimiento, setConsentimiento] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [reporte, setReporte] = useState<Reporte | null>(null)
  const abierto = filas !== null || reporte !== null || error !== ''
  const n = NOMBRE_TIPO[tipo]
  const validas = filas?.filter((f) => !f.ejemplo && !f.errores.length).length ?? 0

  const cerrar = () => {
    setFilas(null)
    setReporte(null)
    setError('')
    setConsentimiento(false)
  }

  const abrir = async (archivo: File) => {
    cerrar()
    const lectura = await leerExcel(tipo, archivo)
    if (lectura.errores.length) return setError(lectura.errores.join(' '))
    if (lectura.filas.length === 0) return setError('El archivo no tiene filas con datos.')
    setFilas(revisar(db, tipo, lectura))
  }

  const confirmar = async () => {
    if (!filas) return
    setOcupado(true)
    setError('')
    try {
      const plan = planear(db, tipo, filas, { demo: esDemo })
      await act(plan.aplicar, { action: `Importó ${n.plural} desde Excel`, detail: plural(plan.importadas, n.singular, n.plural) })
      const validasFilas = filas.filter((f) => !f.ejemplo && !f.errores.length)
      const r: Reporte = {
        importadas: plan.importadas,
        reutilizadas: plan.reutilizadas,
        gruposNuevos: [...new Set(validasFilas.filter((f) => f.grupoNuevo).map((f) => f.grupoNuevo!))],
        rechazadas: filas.filter((f) => !f.ejemplo && f.errores.length),
        sinCorreo: plan.sinCorreo,
        invitaciones: [],
      }
      if (cuenta && plan.invitaciones.length) {
        try {
          r.invitaciones = await enviarInvitaciones(cuenta.token, plan.invitaciones)
        } catch (e) {
          r.errorInvitaciones = e instanceof Error ? e.message : 'Error desconocido'
        }
      }
      setFilas(null)
      setReporte(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo importar.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <BotonPlantilla tipo={tipo} />
      <FilePickButton icon="subir" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onFile={(f) => void abrir(f)}>
        Importar Excel
      </FilePickButton>
      <Modal open={abierto} onClose={cerrar} title={reporte ? 'Importación terminada' : `Importar ${n.plural} desde Excel`}>
        <div className="grid gap-4">
          {error && <Notice tone="peligro">{error}</Notice>}
          {filas && <VistaPrevia filas={filas} />}
          {filas && tipo === 'alumnos' && validas > 0 && (
            <label className="flex min-h-11 items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 size-4" checked={consentimiento} onChange={(e) => setConsentimiento(e.target.checked)} />
              <span>La escuela tiene el consentimiento de las madres, padres o tutores para registrar a estos menores (aviso de privacidad).</span>
            </label>
          )}
          {esDemo && filas && <Notice tone="info">En la demo los datos se importan, pero no se mandan invitaciones.</Notice>}
          {filas && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secundario" onClick={cerrar}>Cancelar</Button>
              <Button icon="check" disabled={ocupado || validas === 0 || (tipo === 'alumnos' && !consentimiento)} onClick={() => void confirmar()}>
                {ocupado ? 'Importando…' : `Importar ${plural(validas, 'fila válida', 'filas válidas')}`}
              </Button>
            </div>
          )}
          {reporte && (
            <>
              <ReporteImportacion tipo={tipo} reporte={reporte} />
              <div className="flex justify-end">
                <Button onClick={cerrar}>Listo</Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  )
}

