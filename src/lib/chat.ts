// Chat entre docentes y familias. Cada conversación es de una docente con una
// madre, padre o tutor, sobre un alumno en particular.
import type { ChatThread, Database, Session } from '../data/types'
import { teacherGroupIds } from './scope'

export const myThreads = (db: Database, session: Session): ChatThread[] => {
  if (session.role === 'familia') return db.chatThreads.filter((t) => t.guardianId === session.personId)
  if (session.role === 'docente') {
    const groups = teacherGroupIds(db, session.personId)
    return db.chatThreads.filter((t) => t.teacherId === session.personId && groups.has(db.students.find((s) => s.id === t.studentId)?.groupId ?? ''))
  }
  return []
}

export const otherKey = (t: ChatThread, session: Session) => (session.role === 'familia' ? `docente:${t.teacherId}` : `familia:${t.guardianId}`)

export const unreadIn = (db: Database, threadId: string, myKey: string) => db.chatMessages.filter((m) => m.threadId === threadId && m.fromKey !== myKey && !m.readAt).length

/** Con quién puede iniciar una conversación cada perfil. */
export function contactsFor(db: Database, session: Session): { teacherId: string; guardianId: string; studentId: string; label: string }[] {
  const out: { teacherId: string; guardianId: string; studentId: string; label: string }[] = []
  if (session.role === 'familia') {
    for (const st of db.students.filter((s) => s.status === 'activo' && s.guardianIds.includes(session.personId))) {
      const group = db.groups.find((g) => g.id === st.groupId)
      const ids = new Set<string>()
      if (group) ids.add(group.homeroomTeacherId)
      for (const a of db.assignments.filter((x) => x.groupId === st.groupId)) ids.add(a.teacherId)
      for (const tid of ids) {
        const t = db.teachers.find((x) => x.id === tid)
        if (!t?.active) continue
        const subjects = db.assignments.filter((a) => a.groupId === st.groupId && a.teacherId === tid).map((a) => db.subjects.find((s) => s.id === a.subjectId)?.name).filter(Boolean)
        const role = group?.homeroomTeacherId === tid ? 'titular' : subjects.join(', ')
        out.push({ teacherId: tid, guardianId: session.personId, studentId: st.id, label: `${t.firstName} ${t.lastName} (${role}) · ${st.firstName}` })
      }
    }
  }
  if (session.role === 'docente') {
    const groups = teacherGroupIds(db, session.personId)
    for (const st of db.students.filter((s) => s.status === 'activo' && groups.has(s.groupId)).sort((a, b) => a.lastName.localeCompare(b.lastName))) {
      for (const gid of st.guardianIds) {
        const g = db.guardians.find((x) => x.id === gid)
        if (g) out.push({ teacherId: session.personId, guardianId: gid, studentId: st.id, label: `${g.firstName} ${g.lastName} (${g.relation.toLowerCase()} de ${st.firstName} ${st.lastName})` })
      }
    }
  }
  return out
}
