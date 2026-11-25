import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { Avatar, Badge, Button, Card, Field, FilePickButton, Input, Notice, PageHeader, Select, Tabs } from '../../components/ui'
import { checkinsOfDay, evaluateScan, presenceOf } from '../../lib/presence'
import { groupLabel, studentName, visibleGroups, visibleStudents } from '../../lib/scope'
import { plural } from '../../lib/format'
import { useApp } from '../../state/context'
import { placesOf } from '../../lib/branding'


type Feedback = { tone: 'entrada' | 'salida' | 'error'; title: string; detail: string; name?: string; photo?: string | null }
type CamState = 'apagada' | 'iniciando' | 'activa' | 'no-disponible' | 'negada'

/** Se recuerda que ya se dio permiso de cámara: la próxima vez el escáner se abre solo. */
const CAM_KEY = 'edugrid.camara'
const camRemembered = () => {
  try {
    return localStorage.getItem(CAM_KEY) === 'ok'
  } catch {
    return false
  }
}

/** Escanear credenciales QR: entrada y, al volver a escanear, salida. */
export function ScanPage() {
  const { db, session, act, log } = useApp()
  const places = placesOf(db.meta)
  const [placeChoice, setPlace] = useState('')
  const place = places.includes(placeChoice) ? placeChoice : places[0]!
  const [code, setCode] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [cam, setCam] = useState<CamState>('apagada')
  const [filter, setFilter] = useState<'todos' | 'dentro' | 'salio' | 'sin-registro'>('todos')
  const groups = visibleGroups(db, session)
  const [groupId, setGroupId] = useState(session.role === 'admin' ? 'todos' : (groups[0]?.id ?? 'todos'))
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const busy = useRef(false)
  const dbRef = useRef(db)
  dbRef.current = db

  const register = useCallback(
    async (raw: string, fromCamera = false) => {
      // La pausa solo aplica a la cámara, para que no lea el mismo código varias veces seguidas
      if (fromCamera && busy.current) return
      if (fromCamera) busy.current = true
      try {
        const r = evaluateScan(dbRef.current, session, raw, place)
        if (!r.ok) {
          setFeedback({ tone: 'error', title: r.reason === 'repetido' ? 'Ya quedó registrado' : 'No se registró', detail: r.message })
          if (r.reason === 'sin-permiso' && r.student) await log({ action: 'Intentó registrar entrada de un alumno ajeno', detail: studentName(r.student), kind: 'denegado' })
          return
        }
        await act(
          async (repo) => {
            await repo.insert('checkins', [r.checkin])
            await repo.insert('notifications', r.notifications)
            if (r.attendance) await repo.insert('attendance', [r.attendance])
          },
          { action: r.checkin.type === 'entrada' ? 'Registró entrada con QR' : 'Registró salida con QR', detail: `${studentName(r.student)} · ${place}` },
        )
        setFeedback({
          tone: r.checkin.type,
          title: `${r.checkin.type === 'entrada' ? 'Entrada' : 'Salida'}: ${studentName(r.student)}`,
          detail: `${groupLabel(dbRef.current, r.student.groupId)} · ${r.checkin.at.slice(11, 16)} · Se avisó a su familia.${r.attendance ? ` Asistencia: ${r.attendance.status === 'retardo' ? 'retardo' : 'asistió'}.` : ''}`,
          name: studentName(r.student),
          photo: r.student.photo,
        })
        setCode('')
      } finally {
        if (fromCamera) setTimeout(() => { busy.current = false }, 1500)
      }
    },
    [act, log, place, session],
  )

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCam((c) => (c === 'no-disponible' ? c : 'apagada'))
  }, [])

  const startCamera = useCallback(async () => {
    setCam('iniciando')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('sin cámara')
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      streamRef.current = stream
      try {
        localStorage.setItem(CAM_KEY, 'ok')
      } catch {
        /* sin almacenamiento: se volverá a pedir con el botón */
      }
      const v = videoRef.current
      if (!v) return
      v.srcObject = stream
      await v.play()
      setCam('activa')
    } catch (e) {
      const denied = e instanceof DOMException && e.name === 'NotAllowedError'
      if (denied) {
        try {
          localStorage.removeItem(CAM_KEY)
        } catch {
          /* nada que limpiar */
        }
      }
      setCam(denied ? 'negada' : 'no-disponible')
    }
  }, [])

  // Si ya se dio permiso antes, el escáner se abre solo al entrar (el navegador no vuelve a preguntar).
  useEffect(() => {
    let cancelled = false
    const auto = async () => {
      let granted = false
      try {
        const st = await navigator.permissions?.query({ name: 'camera' as PermissionName })
        granted = st?.state === 'granted'
        if (st?.state === 'denied') return
      } catch {
        /* el navegador no informa el permiso: se usa lo que recordamos */
      }
      if (!cancelled && (granted || camRemembered())) void startCamera()
    }
    void auto()
    return () => {
      cancelled = true
    }
  }, [startCamera])

  // Leer el QR desde una foto (si la cámara en vivo no está disponible).
  const scanPhoto = async (file: File) => {
    const url = URL.createObjectURL(file)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = () => reject(new Error('foto'))
        i.src = url
      })
      const w = Math.min(1024, img.naturalWidth)
      const h = Math.round((img.naturalHeight * w) / img.naturalWidth)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('foto')
      ctx.drawImage(img, 0, 0, w, h)
      const { default: jsQR } = await import('jsqr')
      const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h)
      if (found?.data) await register(found.data)
      else setFeedback({ tone: 'error', title: 'No se encontró un QR', detail: 'Toma la foto más de cerca y con buena luz, o escribe el código.' })
    } catch {
      setFeedback({ tone: 'error', title: 'No se pudo leer la foto', detail: 'Intenta con otra foto o escribe el código.' })
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  // Lee cuadros de la cámara y busca un QR (la librería se carga solo al usar la cámara).
  useEffect(() => {
    if (cam !== 'activa') return
    let stop = false
    let timer = 0
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    void import('jsqr').then(({ default: jsQR }) => {
      const tick = () => {
        if (stop) return
        const v = videoRef.current
        if (v && ctx && v.videoWidth) {
          const w = Math.min(640, v.videoWidth)
          const h = Math.round((v.videoHeight * w) / v.videoWidth)
          canvas.width = w
          canvas.height = h
          ctx.drawImage(v, 0, 0, w, h)
          const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })
          if (found?.data) void register(found.data, true)
        }
        timer = window.setTimeout(tick, 250)
      }
      tick()
    })
    return () => {
      stop = true
      clearTimeout(timer)
    }
  }, [cam, register])

  useEffect(() => stopCamera, [stopCamera])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void register(code)
  }

  const students = visibleStudents(db, session).filter((s) => groupId === 'todos' || s.groupId === groupId)
  const states = students.map((s) => ({ s, state: presenceOf(db, s.id), list: checkinsOfDay(db, s.id) }))
  const count = (k: 'dentro' | 'salio' | 'sin-registro') => states.filter((x) => x.state === k).length
  const shown = states.filter((x) => filter === 'todos' || x.state === filter).sort((a, b) => a.s.lastName.localeCompare(b.s.lastName))

  return (
    <>
      <PageHeader title="Entradas y salidas" subtitle="Escanea la credencial QR. La primera lectura del día es la entrada; la siguiente, la salida. La familia recibe un aviso en ese momento." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Escanear">
          <div className="relative mb-3 aspect-[4/3] overflow-hidden rounded-xl bg-navy">
            <video ref={videoRef} className={`size-full object-cover ${cam === 'activa' ? '' : 'hidden'}`} muted playsInline aria-label="Vista de la cámara" />
            {cam !== 'activa' && (
              <div className="flex size-full flex-col items-center justify-center gap-3 p-4 text-center text-white">
                <Icon name="qr" size={48} />
                <p className="text-sm">{cam === 'iniciando' ? 'Abriendo la cámara…' : cam === 'no-disponible' ? 'La cámara no está disponible aquí.' : cam === 'negada' ? 'No hay permiso para usar la cámara.' : 'Toca «Abrir cámara» y apunta a la credencial.'}</p>
              </div>
            )}
            {cam === 'activa' && <span className="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-cyan" aria-hidden="true" />}
          </div>
          <div className="flex flex-wrap gap-2">
            {cam === 'activa' ? (
              <Button variant="secundario" icon="cerrar" onClick={stopCamera}>Apagar cámara</Button>
            ) : (
              <Button icon="qr" onClick={() => void startCamera()} disabled={cam === 'iniciando'}>Abrir cámara</Button>
            )}
            <FilePickButton icon="camara" accept="image/*" capture="environment" onFile={(f) => void scanPhoto(f)}>Leer QR de una foto</FilePickButton>
          </div>
          {cam === 'apagada' && <p className="mt-2 text-xs text-muted">El navegador pide permiso la primera vez. Después, el escáner se abre solo al entrar.</p>}
          {cam === 'negada' && <div className="mt-3"><Notice tone="aviso">Se negó el permiso de la cámara. Actívalo en el candado de la barra de direcciones del navegador (Permisos → Cámara) y toca «Abrir cámara». Mientras, puedes leer el QR de una foto o escribir el código.</Notice></div>}
          {cam === 'no-disponible' && <div className="mt-3"><Notice tone="aviso">Esta vista no deja usar la cámara en vivo (pasa en la vista previa dentro de otras apps). Abre EDUGRID en el navegador del celular, lee el QR de una foto o escribe el código que aparece debajo del QR.</Notice></div>}

          <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" noValidate>
            <Field label="O escribe el código de la credencial">{(id) => <Input id={id} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ej. ABCD-2345" autoComplete="off" autoCapitalize="characters" />}</Field>
            <Button type="submit" icon="check">Registrar</Button>
          </form>
          <div className="mt-3">
            <Field label="Lugar">
              {(id) => (
                <Select id={id} value={place} onChange={(e) => setPlace(e.target.value)}>
                  {places.map((p) => <option key={p}>{p}</option>)}
                </Select>
              )}
            </Field>
          </div>

          <div aria-live="assertive" className="mt-4">
            {feedback && (
              <div className={`rounded-2xl p-4 ${feedback.tone === 'entrada' ? 'bg-success-bg text-success' : feedback.tone === 'salida' ? 'bg-info-bg text-info' : 'bg-danger-bg text-danger'}`}>
                <div className="flex items-center gap-3">
                  {feedback.name && <Avatar name={feedback.name} src={feedback.photo} size={64} />}
                  <div className="min-w-0">
                    <p className="text-lg font-bold">{feedback.title}</p>
                    <p className="text-sm">{feedback.detail}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card title="Hoy">
          {groups.length > 1 && (
            <div className="mb-3">
              <Field label="Grupo">
                {(id) => (
                  <Select id={id} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                    {session.role === 'admin' && <option value="todos">Todos los grupos</option>}
                    {groups.map((g) => <option key={g.id} value={g.id}>{groupLabel(db, g)}</option>)}
                  </Select>
                )}
              </Field>
            </div>
          )}
          <Tabs
            label="Filtrar alumnos"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'todos', label: `Todos (${students.length})` },
              { value: 'dentro', label: `Dentro (${count('dentro')})` },
              { value: 'salio', label: `Salieron (${count('salio')})` },
              { value: 'sin-registro', label: `Sin registro (${count('sin-registro')})` },
            ]}
          />
          {shown.length === 0 ? (
            <p className="text-sm text-muted">No hay alumnos en esta lista.</p>
          ) : (
            <ul className="divide-y divide-line">
              {shown.slice(0, 60).map(({ s, state, list }) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={studentName(s)} src={s.photo} size={36} />
                    <div className="min-w-0">
                      <p className="font-semibold text-heading">{studentName(s)}</p>
                      <p className="text-xs text-muted">
                        {groupLabel(db, s.groupId)}
                        {list.length > 0 && ` · ${list.map((c) => `${c.type === 'entrada' ? 'entró' : 'salió'} ${c.at.slice(11, 16)}`).join(', ')}`}
                      </p>
                    </div>
                  </div>
                  {state === 'dentro' && <Badge tone="exito">Dentro</Badge>}
                  {state === 'salio' && <Badge tone="info">Salió</Badge>}
                  {state === 'sin-registro' && <Badge>Sin registro</Badge>}
                </li>
              ))}
            </ul>
          )}
          {shown.length > 60 && <p className="mt-2 text-xs text-muted">Se muestran 60 de {plural(shown.length, 'alumno', 'alumnos')}. Elige un grupo para ver menos.</p>}
        </Card>
      </div>
    </>
  )
}
