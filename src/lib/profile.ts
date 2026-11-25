import type { Database, Session } from '../data/types'
import { ROLE_LABEL } from './permissions'

/** Tabla donde vive la ficha de cada perfil. */
const TABLE = { admin: 'staff', docente: 'teachers', familia: 'guardians', alumno: 'students' } as const

export interface Profile {
  table: (typeof TABLE)[keyof typeof TABLE]
  id: string
  name: string
  roleLabel: string
  /** Avatar: la foto o imagen que la persona eligió para su cuenta. */
  profilePhoto: string | null
  /** Foto institucional que tomó la escuela al empadronar (solo la cambia la dirección). */
  institutionalPhoto: string | null
  /** Foto que se muestra en el menú: la de perfil o, si no hay, la institucional. */
  avatar: string | null
  email: string
  phone: string
  /** ¿Puede capturar teléfono? (los alumnos no; la escuela usa el de sus tutores). */
  hasPhone: boolean
}

/** La imagen que se muestra de una persona: su avatar o, si no eligió uno, la foto institucional. */
export const avatarOf = (p?: { photo?: string | null; profilePhoto?: string | null }) => p?.profilePhoto ?? p?.photo ?? null

export function profileOf(db: Database, session: Session): Profile {
  const table = TABLE[session.role]
  const base = { table, id: session.personId, name: session.name, roleLabel: ROLE_LABEL[session.role], hasPhone: true }
  const photos = (p?: { photo?: string | null; profilePhoto?: string | null }) => ({ profilePhoto: p?.profilePhoto ?? null, institutionalPhoto: p?.photo ?? null, avatar: avatarOf(p) })
  if (session.role === 'admin') {
    const s = db.staff.find((x) => x.id === session.personId)
    return { ...base, ...photos(s), name: s?.name ?? session.name, roleLabel: s?.position ?? base.roleLabel, email: s?.email ?? '', phone: s?.phone ?? '' }
  }
  if (session.role === 'docente') {
    const t = db.teachers.find((x) => x.id === session.personId)
    return { ...base, ...photos(t), email: t?.email ?? '', phone: t?.phone ?? '' }
  }
  if (session.role === 'familia') {
    const g = db.guardians.find((x) => x.id === session.personId)
    return { ...base, ...photos(g), email: g?.email ?? '', phone: g?.phone ?? '' }
  }
  const st = db.students.find((x) => x.id === session.personId)
  return { ...base, ...photos(st), email: st?.email ?? '', phone: '', hasPhone: false }
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
/** Teléfono de México: 10 dígitos (se aceptan espacios y guiones al escribir). */
export const phoneDigits = (v: string) => v.replace(/\D/g, '')
