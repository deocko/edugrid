import type { AttendanceRecord, AttendanceStatus, CheckIn, Database, Student } from '../data/types'
import type { Tone } from '../components/ui'

export const ATT_LABEL: Record<AttendanceStatus, string> = { presente: 'Asistió', retardo: 'Retardo', falta: 'Falta', justificada: 'Falta justificada' }
export const ATT_TONE: Record<AttendanceStatus, Tone> = { presente: 'exito', retardo: 'aviso', falta: 'peligro', justificada: 'info' }

export function attendanceSummary(db: Database, studentId: string) {
  const list = db.attendance.filter((a) => a.studentId === studentId)
  const count = (s: AttendanceStatus) => list.filter((a) => a.status === s).length
  const rate = list.length ? Math.round(((count('presente') + count('retardo')) / list.length) * 100) : 0
  return { list: [...list].sort((a, b) => b.date.localeCompare(a.date)), rate, presente: count('presente'), retardo: count('retardo'), falta: count('falta'), justificada: count('justificada') }
}

/** Hora de inicio de clases: una entrada con QR después de esta hora cuenta como retardo. */
export const LATE_AFTER = '08:00'

/**
 * La primera entrada con QR del día marca la asistencia del alumno (asistió o retardo),
 * siempre que su docente no haya pasado lista antes. Devuelve null si ya hay registro.
 */
export function attendanceFromEntry(db: Database, student: Student, checkin: CheckIn): AttendanceRecord | null {
  if (checkin.type !== 'entrada') return null
  if (db.attendance.some((a) => a.studentId === student.id && a.date === checkin.date)) return null
  const group = db.groups.find((g) => g.id === student.groupId)
  return {
    id: `as-${student.groupId}-${student.id}-${checkin.date}`,
    groupId: student.groupId,
    studentId: student.id,
    date: checkin.date,
    status: checkin.at.slice(11, 16) > LATE_AFTER ? 'retardo' : 'presente',
    recordedBy: group?.homeroomTeacherId ?? '',
    source: 'qr',
  }
}

/** Estado de asistencia de un día, igual para familia, alumno y docente. */
export const attendanceOfDay = (db: Database, studentId: string, date: string) => db.attendance.find((a) => a.studentId === studentId && a.date === date)
