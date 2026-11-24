import { teacherGroupIds } from '../../lib/scope'
import { useApp } from '../../state/context'

/** Grupos que puede manejar la sesión actual (docente: los suyos; dirección: todos). */
export function useManagedGroups() {
  const { db, session } = useApp()
  if (session.role === 'admin') return db.groups
  const ids = teacherGroupIds(db, session.personId)
  return db.groups.filter((g) => ids.has(g.id))
}

/** Materias que la sesión puede calificar en un grupo. */
export function useManagedSubjects(groupId: string) {
  const { db, session } = useApp()
  return db.assignments.filter((a) => a.groupId === groupId && (session.role === 'admin' || a.teacherId === session.personId))
}
