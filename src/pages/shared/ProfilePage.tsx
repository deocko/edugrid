import { useNavigate } from 'react-router'
import { ElegirPerfil } from '../cuenta/ElegirPerfil'
import { useState, type FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { Avatar, Badge, Button, Card, Field, FilePickButton, Input, Notice, PageHeader } from '../../components/ui'
import { compressAvatar } from '../../lib/photo'
import { EMAIL_RE, phoneDigits, profileOf } from '../../lib/profile'
import { useApp } from '../../state/context'

/**
 * «Mi perfil»: cada persona cambia su foto de perfil, su correo y su teléfono.
 * El nombre y los datos oficiales los mantiene la dirección. En los alumnos, la foto
 * institucional (credencial y expediente) sigue siendo la que sube la escuela.
 */
export function ProfilePage() {
  const { db, session, act, cuenta, esDemo, cambiarPerfil } = useApp()
  const navigate = useNavigate()
  const p = profileOf(db, session)
  const [email, setEmail] = useState(p.email)
  const [phone, setPhone] = useState(p.phone)
  const [busy, setBusy] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [errors, setErrors] = useState<{ email?: string; phone?: string }>({})
  const [saved, setSaved] = useState(false)
  const isStudent = session.role === 'alumno'

  const pick = async (file?: File) => {
    if (!file) return
    setPhotoError('')
    setBusy(true)
    try {
      const profilePhoto = await compressAvatar(file)
      await act((repo) => repo.update(p.table, p.id, { profilePhoto }), { action: p.profilePhoto ? 'Cambió su foto de perfil' : 'Agregó foto de perfil', detail: p.name })
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : 'No se pudo guardar la foto.')
    } finally {
      setBusy(false)
    }
  }
  const removePhoto = () => act((repo) => repo.update(p.table, p.id, { profilePhoto: null }), { action: 'Quitó su foto de perfil', detail: p.name })

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setSaved(false)
    const next: typeof errors = {}
    const mail = email.trim()
    const digits = phoneDigits(phone)
    if (mail && !EMAIL_RE.test(mail)) next.email = 'Escribe un correo válido, por ejemplo nombre@correo.com.'
    if (!isStudent && !mail) next.email = 'El correo es obligatorio para recibir avisos.'
    if (p.hasPhone && digits.length !== 10) next.phone = 'Escribe un teléfono de 10 dígitos.'
    setErrors(next)
    if (next.email || next.phone) return
    const patch = p.hasPhone ? { email: mail, phone: digits } : { email: mail }
    await act((repo) => repo.update(p.table, p.id, patch), { action: 'Actualizó sus datos de contacto', detail: p.name })
    setSaved(true)
  }

  return (
    <>
      <PageHeader title="Mi perfil" subtitle={esDemo ? 'Tu foto y tus datos de contacto. Los cambios se guardan en esta demo.' : 'Tu foto y tus datos de contacto.'} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
        <Card title="Foto de perfil">
          <div className="flex flex-col items-center text-center">
            <Avatar name={p.name} src={p.avatar} size={120} />
            <p className="mt-3 text-lg font-bold text-heading">{p.name}</p>
            <p className="text-sm text-muted">{p.roleLabel}</p>
            <div className="mt-4 flex w-full flex-col gap-2">
              <FilePickButton icon="camara" accept="image/*" disabled={busy} onFile={(f) => void pick(f)}>
                {busy ? 'Guardando…' : p.profilePhoto ? 'Cambiar foto de perfil' : 'Agregar foto de perfil'}
              </FilePickButton>
              {p.profilePhoto && (
                <Button variant="fantasma" icon="cerrar" onClick={() => void removePhoto()}>
                  Quitar foto de perfil
                </Button>
              )}
            </div>
            {photoError && <div className="mt-3 w-full text-left"><Notice tone="peligro">{photoError}</Notice></div>}
          </div>
          {isStudent && (
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
              <Avatar name={p.name} src={p.institutionalPhoto} size={56} />
              <div className="min-w-0 text-sm">
                <p className="font-bold text-heading">Foto institucional</p>
                <p className="text-muted">
                  {p.institutionalPhoto ? 'La usa la escuela en tu credencial y tu expediente.' : 'La escuela aún no sube tu foto institucional.'} Solo la dirección la puede cambiar.
                </p>
              </div>
            </div>
          )}
        </Card>

        <Card title="Datos de contacto">
          <form onSubmit={(e) => void save(e)} noValidate className="space-y-4">
            <div>
              <p className="mb-1 text-sm font-semibold text-heading">Nombre</p>
              <p className="flex min-h-11 items-center gap-2 rounded-xl bg-surface-2 px-3 text-ink">
                <Icon name="candado" size={16} className="text-muted" />
                {p.name}
              </p>
              <p className="mt-1 text-xs text-muted">Para corregir tu nombre u otros datos oficiales, pídelo a la dirección.</p>
            </div>
            <Field label={isStudent ? 'Correo personal (opcional)' : 'Correo electrónico'} hint={isStudent ? undefined : 'Aquí te llegan los avisos y recibos.'}>
              {(id) => (
                <>
                  <Input id={id} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => { setEmail(e.target.value); setSaved(false) }} aria-invalid={!!errors.email} aria-describedby={errors.email ? `${id}-err` : undefined} />
                  {errors.email && <p id={`${id}-err`} className="mt-1 text-sm font-semibold text-danger">{errors.email}</p>}
                </>
              )}
            </Field>
            {p.hasPhone && (
              <Field label="Teléfono celular" hint="10 dígitos, sin lada internacional.">
                {(id) => (
                  <>
                    <Input id={id} type="tel" autoComplete="tel-national" inputMode="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setSaved(false) }} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? `${id}-err` : undefined} />
                    {errors.phone && <p id={`${id}-err`} className="mt-1 text-sm font-semibold text-danger">{errors.phone}</p>}
                  </>
                )}
              </Field>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" icon="check">Guardar cambios</Button>
              <span role="status" aria-live="polite">{saved && <Badge tone="exito">Cambios guardados</Badge>}</span>
            </div>
          </form>
        </Card>
      </div>
      {cuenta && cuenta.perfiles.length > 1 && (
        <Card title="Mis perfiles en esta escuela" className="mt-4">
          <p className="mb-3 text-sm text-muted">Tu cuenta ({cuenta.usuario.correo}) tiene varios perfiles. Cambia de perfil sin cerrar sesión.</p>
          <ElegirPerfil
            perfiles={cuenta.perfiles}
            actual={cuenta.perfil?.id}
            onElegir={async (id) => {
              await cambiarPerfil(id)
              navigate('/', { replace: true })
            }}
          />
        </Card>
      )}
    </>
  )
}
