// Reglas de visibilidad de datos por rol. Toda pantalla que muestre datos de
// alumnos debe pasar por estas funciones: así nunca se muestran datos de un
// menor a quien no le corresponde.
import type { Announcement, Database, Group, Guardian, Level, SchoolEvent, Session, Student } from '../data/types'

export const gradeOfGroup = (db: Database, groupId: string) => {
  const group = db.groups.find((g) => g.id === groupId)
  return group ? db.grades.find((g) => g.id === group.gradeId) : undefined
}

export const levelOfGroup = (db: Database, groupId: string): Level | undefined => gradeOfGroup(db, groupId)?.level

export const groupLabel = (db: Database, group: Group | string | undefined) => {
  const g = typeof group === 'string' ? db.groups.find((x) => x.id === group) : group
  if (!g) return 'Sin grupo'
  const grade = db.grades.find((x) => x.id === g.gradeId)
  return `${grade?.name ?? ''} ${g.name}`.trim()
}

export const studentName = (s: Student | undefined) => (s ? `${s.firstName} ${s.lastName}` : 'Alumno')

export const teacherName = (db: Database, id: string) => {
  const t = db.teachers.find((x) => x.id === id)
  return t ? `${t.firstName} ${t.lastName}` : 'Docente'
}

export const subjectName = (db: Database, id: string) => db.subjects.find((x) => x.id === id)?.name ?? 'Materia'

/** Grupos donde el docente es titular o imparte alguna materia. */
export const teacherGroupIds = (db: Database, teacherId: string) => {
  const ids = new Set<string>()
  for (const g of db.groups) if (g.homeroomTeacherId === teacherId) ids.add(g.id)
  for (const a of db.assignments) if (a.teacherId === teacherId) ids.add(a.groupId)
  return ids
}

export const visibleStudents = (db: Database, session: Session): Student[] => {
  const active = db.students.filter((s) => s.status === 'activo')
  switch (session.role) {
    case 'admin':
      return active
    case 'docente': {
      const groups = teacherGroupIds(db, session.personId)
      return active.filter((s) => groups.has(s.groupId))
    }
    case 'familia':
      return active.filter((s) => s.guardianIds.includes(session.personId))
    case 'alumno':
      return active.filter((s) => s.id === session.personId)
  }
}

export const canSeeStudent = (db: Database, session: Session, studentId: string) =>
  session.role === 'admin' ? db.students.some((s) => s.id === studentId) : visibleStudents(db, session).some((s) => s.id === studentId)

export const visibleGroups = (db: Database, session: Session): Group[] => {
  if (session.role === 'admin') return db.groups
  const ids = new Set(visibleStudents(db, session).map((s) => s.groupId))
  if (session.role === 'docente') for (const id of teacherGroupIds(db, session.personId)) ids.add(id)
  return db.groups.filter((g) => ids.has(g.id))
}

const audienceMatches = (db: Database, audience: Announcement['audience'], groupIds: Set<string>) => {
  if (audience.type === 'escuela') return true
  if (audience.type === 'grupo') return groupIds.has(audience.groupId)
  const levels = new Set([...groupIds].map((g) => levelOfGroup(db, g)))
  // Los avisos de kinder también aplican a maternal (preescolar)
  if (audience.level === 'kinder' && levels.has('maternal')) return true
  return levels.has(audience.level)
}

export const visibleAnnouncements = (db: Database, session: Session): Announcement[] => {
  const list = session.role === 'admin' ? db.announcements : db.announcements.filter((a) => audienceMatches(db, a.audience, new Set(visibleGroups(db, session).map((g) => g.id))))
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export const visibleEvents = (db: Database, session: Session): SchoolEvent[] => {
  const groups = new Set(visibleGroups(db, session).map((g) => g.id))
  const list = session.role === 'admin' ? db.events : db.events.filter((e) => audienceMatches(db, e.audience, groups))
  return [...list].sort((a, b) => a.date.localeCompare(b.date))
}

export const userKey = (session: Session) => `${session.role}:${session.personId}`

export const audienceLabel = (db: Database, a: Announcement['audience']) => {
  if (a.type === 'escuela') return 'Toda la escuela'
  if (a.type === 'nivel') return a.level === 'kinder' ? 'Preescolar (maternal y kinder)' : `Nivel ${LEVEL_LABEL[a.level].toLowerCase()}`
  return groupLabel(db, a.groupId)
}

export const LEVEL_LABEL: Record<Level, string> = {
  maternal: 'Maternal',
  kinder: 'Kinder',
  primaria: 'Primaria',
  secundaria: 'Secundaria',
  preparatoria: 'Preparatoria',
}

export const LEVELS: Level[] = ['maternal', 'kinder', 'primaria', 'secundaria', 'preparatoria']

export const isPreschool = (level: Level | undefined) => level === 'maternal' || level === 'kinder'

export const PRESCHOOL_SCALE: Record<number, string> = {
  1: 'Requiere apoyo',
  2: 'En proceso',
  3: 'Logrado',
  4: 'Destacado',
}

export const formatScore = (level: Level | undefined, score: number | undefined) => {
  if (score === undefined) return '—'
  if (isPreschool(level)) return PRESCHOOL_SCALE[score] ?? '—'
  return (Math.round(score * 10) / 10).toFixed(1)
}

/** Promedio numérico del alumno en un periodo (no aplica a preescolar). */
export const averageFor = (db: Database, studentId: string, periodId: string): number | null => {
  const list = db.gradeRecords.filter((r) => r.studentId === studentId && r.periodId === periodId)
  if (list.length === 0) return null
  return Math.round((list.reduce((s, r) => s + r.score, 0) / list.length) * 10) / 10
}

/** Promedio con un decimal, igual en todas las vistas (familia, alumno, admin y boleta). */
export const formatAverage = (avg: number | null) => (avg === null ? '—' : avg.toFixed(1))

/** Un hogar: los tutores que comparten a uno o más alumnos (hermanos). */
export interface Family {
  key: string
  guardians: Guardian[]
  students: Student[]
}

/** Agrupa alumnos por hogar. Los hermanos tienen los mismos tutores, así que cuentan como una familia. */
export function familiesOf(db: Database, students: Student[]): Family[] {
  const map = new Map<string, Family>()
  for (const s of students) {
    const key = [...s.guardianIds].sort().join('+')
    const f = map.get(key) ?? { key, guardians: db.guardians.filter((g) => s.guardianIds.includes(g.id)), students: [] }
    f.students.push(s)
    map.set(key, f)
  }
  return [...map.values()]
}
