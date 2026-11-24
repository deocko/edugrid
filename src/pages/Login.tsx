import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Isotipo, Logo } from '../brand/Logo'
import { Icon, type IconName } from '../components/Icon'
import { Button, DemoBadge, Select } from '../components/ui'
import type { Role, Session } from '../data/types'
import { HOME_BY_ROLE } from '../lib/permissions'
import { groupLabel, isPreschool, levelOfGroup, studentName } from '../lib/scope'
import { useStore } from '../state/context'
import { plural } from '../lib/format'

interface RoleCard {
  role: Role
  title: string
  description: string
  icon: IconName
}

const CARDS: RoleCard[] = [
  { role: 'admin', title: 'Entrar como Administrador', description: 'Dirección y administración: alumnos, pagos, avisos y facturación.', icon: 'escudo' },
  { role: 'docente', title: 'Entrar como Docente', description: 'Pasa lista, captura calificaciones y deja tareas a tus grupos.', icon: 'docente' },
  { role: 'familia', title: 'Entrar como Papá', description: 'Consulta calificaciones, asistencia y pagos de tus hijos.', icon: 'hijo' },
  { role: 'alumno', title: 'Entrar como Alumno', description: 'Revisa tu horario, tus tareas y tus calificaciones.', icon: 'libro' },
]

export function Login() {
  const { db, login, resetDemo } = useStore()
  const navigate = useNavigate()
  const [choice, setChoice] = useState<Record<Role, string>>({ admin: 'adm1', docente: 't14', familia: 'tu0', alumno: 'al1' })
  const [busy, setBusy] = useState<Role | null>(null)
  const [resetDone, setResetDone] = useState(false)
  if (!db) return null

  const teacherOptions = db.teachers.filter((t) => t.active).map((t) => {
    const groups = db.groups.filter((g) => g.homeroomTeacherId === t.id).map((g) => groupLabel(db, g))
    // Etiqueta corta para que el nombre no se corte en el selector
    return { id: t.id, label: groups.length ? `${t.firstName} ${t.lastName} · ${groups.join(', ')} (titular)` : `${t.firstName} ${t.lastName} · ${t.specialty}` }
  })
  const familyOptions = db.guardians.slice(0, 20).map((g) => {
    const kids = db.students.filter((s) => s.guardianIds.includes(g.id)).length
    return { id: g.id, label: `${g.firstName} ${g.lastName} · ${plural(kids, 'hijo', 'hijos')}` }
  })
  const studentOptions = db.students
    .filter((s) => !isPreschool(levelOfGroup(db, s.groupId)))
    .map((s) => ({ id: s.id, label: `${studentName(s)} · ${groupLabel(db, s.groupId)}` }))

  const options: Record<Role, { id: string; label: string }[]> = {
    admin: db.staff.map((s) => ({ id: s.id, label: `${s.name} · ${s.position}` })),
    docente: teacherOptions,
    familia: familyOptions,
    alumno: studentOptions,
  }
  const selected = (role: Role) => choice[role] || options[role][0]?.id || ''

  const enter = async (role: Role) => {
    const id = selected(role)
    let name = ''
    if (role === 'admin') name = db.staff.find((s) => s.id === id)?.name ?? ''
    if (role === 'docente') {
      const t = db.teachers.find((x) => x.id === id)
      name = t ? `${t.firstName} ${t.lastName}` : ''
    }
    if (role === 'familia') {
      const g = db.guardians.find((x) => x.id === id)
      name = g ? `${g.firstName} ${g.lastName}` : ''
    }
    if (role === 'alumno') name = studentName(db.students.find((x) => x.id === id))
    const session: Session = { role, personId: id, name }
    setBusy(role)
    await login(session)
    navigate(HOME_BY_ROLE[role], { replace: true })
  }

  return (
    <div className="min-h-dvh bg-bg">
      <div className="bg-navy text-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 sm:py-12">
          <span className="inline-flex w-fit rounded-2xl bg-white px-4 py-3">
            <Logo height={40} plate="never" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-wide text-cyan uppercase">Administra tu Escuela</p>
            <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">Una escuela. Todos conectados.</h1>
            <p className="mt-2 max-w-2xl text-[#dbe3ee]">
              Dirección, docentes, familias y alumnos en un solo lugar. Elige cómo quieres entrar a la demo del <strong className="text-white">{db.meta.school.name}</strong>.
            </p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-warning/40 bg-warning-bg px-4 py-3 text-sm text-warning">
          <DemoBadge />
          <span>Esta es una demostración: no se piden contraseñas y todos los datos son ficticios.</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {CARDS.map((c) => (
            <section key={c.role} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-info-bg p-2.5 text-info">
                  <Icon name={c.icon} size={24} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-heading">{c.title}</h2>
                  <p className="text-sm text-muted">{c.description}</p>
                </div>
              </div>
              <label className="text-sm font-semibold text-heading" htmlFor={`cuenta-${c.role}`}>
                Cuenta demo
              </label>
              <Select id={`cuenta-${c.role}`} value={selected(c.role)} onChange={(e) => setChoice({ ...choice, [c.role]: e.target.value })}>
                {options[c.role].map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <Button onClick={() => void enter(c.role)} disabled={busy !== null} className="mt-auto w-full" icon="derecha">
                {busy === c.role ? 'Entrando…' : c.title}
              </Button>
            </section>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-start gap-3 border-t border-line pt-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-md bg-white p-0.5">
              <Isotipo size={22} />
            </span>
            <span>
              Cuidamos los datos de niñas, niños y jóvenes.{' '}
              <Link to="/privacidad" className="font-semibold text-link underline">
                Lee el aviso de privacidad
              </Link>
            </span>
          </div>
          <Button
            variant="secundario"
            onClick={() => {
              void resetDemo().then(() => setResetDone(true))
            }}
          >
            {resetDone ? 'Datos demo restablecidos' : 'Restablecer datos demo'}
          </Button>
        </div>
      </main>
    </div>
  )
}
