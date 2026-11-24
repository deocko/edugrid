import type { AttendanceStatus, Database } from '../data/types'
import type { Tone } from '../components/ui'

export const ATT_LABEL: Record<AttendanceStatus, string> = { presente: 'Asistió', retardo: 'Retardo', falta: 'Falta', justificada: 'Falta justificada' }
export const ATT_TONE: Record<AttendanceStatus, Tone> = { presente: 'exito', retardo: 'aviso', falta: 'peligro', justificada: 'info' }

export function attendanceSummary(db: Database, studentId: string) {
  const list = db.attendance.filter((a) => a.studentId === studentId)
  const count = (s: AttendanceStatus) => list.filter((a) => a.status === s).length
  const rate = list.length ? Math.round(((count('presente') + count('retardo')) / list.length) * 100) : 0
  return { list: [...list].sort((a, b) => b.date.localeCompare(a.date)), rate, presente: count('presente'), retardo: count('retardo'), falta: count('falta'), justificada: count('justificada') }
}
