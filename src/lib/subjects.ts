import type { Database, SubjectColor } from '../data/types'

export const SUBJECT_COLORS: { value: SubjectColor; label: string; hex: string }[] = [
  { value: 'azul', label: 'Azul', hex: '#1769d2' },
  { value: 'rojo', label: 'Rojo', hex: '#d1343a' },
  { value: 'verde', label: 'Verde', hex: '#1f8f52' },
  { value: 'naranja', label: 'Naranja', hex: '#d4690f' },
  { value: 'morado', label: 'Morado', hex: '#7a4fd0' },
  { value: 'turquesa', label: 'Turquesa', hex: '#0e8fa0' },
  { value: 'rosa', label: 'Rosa', hex: '#c93a82' },
  { value: 'ambar', label: 'Ámbar', hex: '#b98400' },
  { value: 'indigo', label: 'Índigo', hex: '#3f51b5' },
  { value: 'gris', label: 'Gris', hex: '#64748b' },
]

export const subjectColor = (db: Database, subjectId: string): SubjectColor => db.subjects.find((s) => s.id === subjectId)?.color ?? 'gris'

/** Clase que activa las variables de color de la materia (--s, --s-bg, --s-ink). */
export const subjectClass = (db: Database, subjectId: string) => `subj-${subjectColor(db, subjectId)}`

export const subjectHex = (db: Database, subjectId: string) => SUBJECT_COLORS.find((c) => c.value === subjectColor(db, subjectId))?.hex ?? '#64748b'

/** Si otra materia del mismo nombre ya tiene color, se usa el mismo; si no, el primero libre del nivel. */
export function suggestColor(db: Database, name: string, level: string): SubjectColor {
  const same = db.subjects.find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase())
  if (same) return same.color
  const used = new Set(db.subjects.filter((s) => s.level === level).map((s) => s.color))
  return SUBJECT_COLORS.find((c) => !used.has(c.value))?.value ?? 'gris'
}

/** Clases para una tarjeta o renglón con la franja de color de la materia. */
export const subjectCard = (db: Database, id: string) => `${subjectClass(db, id)} border-l-4 border-l-[var(--s)] bg-[var(--s-bg)]`

/** Franja de color a la izquierda, sin fondo, para renglones de una lista. */
export const subjectStripe = (db: Database, id: string) => `${subjectClass(db, id)} border-l-4 border-l-[var(--s)] pl-3`
