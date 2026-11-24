// Entradas y salidas con QR: la primera lectura del día es la entrada y la
// siguiente, la salida (y así sucesivamente si el alumno vuelve a entrar).
import type { AppNotification, CheckIn, Database, Session, Student } from '../data/types'
import { nowISO, todayISO, uid } from './format'
import { canSeeStudent, groupLabel, studentName, userKey } from './scope'
import { parseQrInput } from './qr'

/** Tiempo mínimo entre dos lecturas del mismo alumno para no registrar dobles por accidente. */
export const SCAN_COOLDOWN_SECONDS = 60

export const checkinsOfDay = (db: Database, studentId: string, date = todayISO()) =>
  db.checkins.filter((c) => c.studentId === studentId && c.date === date).sort((a, b) => a.at.localeCompare(b.at))

/** «dentro» si su último registro de hoy es una entrada. */
export function presenceOf(db: Database, studentId: string, date = todayISO()): 'sin-registro' | 'dentro' | 'salio' {
  const last = checkinsOfDay(db, studentId, date).at(-1)
  if (!last) return 'sin-registro'
  return last.type === 'entrada' ? 'dentro' : 'salio'
}

export type ScanResult =
  | { ok: true; student: Student; checkin: CheckIn; notifications: AppNotification[] }
  | { ok: false; reason: 'codigo' | 'no-encontrado' | 'sin-permiso' | 'repetido' | 'baja'; message: string; student?: Student }

/** Calcula qué registrar al leer un código. No guarda nada: la pantalla decide. */
export function evaluateScan(db: Database, session: Session, raw: string, place: string): ScanResult {
  const code = parseQrInput(raw)
  if (!code) return { ok: false, reason: 'codigo', message: 'Ese código no es una credencial de EDUGRID.' }
  const student = db.students.find((s) => s.qrCode === code)
  if (!student) return { ok: false, reason: 'no-encontrado', message: 'No encontramos a ningún alumno con ese código.' }
  if (student.status !== 'activo') return { ok: false, reason: 'baja', message: `${studentName(student)} está dado de baja.`, student }
  if (!canSeeStudent(db, session, student.id)) return { ok: false, reason: 'sin-permiso', message: 'Este alumno no es de tus grupos. Pide a la dirección que registre su entrada.', student }
  const now = nowISO()
  const today = checkinsOfDay(db, student.id)
  const last = today.at(-1)
  const elapsed = last ? (Date.parse(now) - Date.parse(last.at)) / 1000 : Infinity
  if (elapsed >= 0 && elapsed < SCAN_COOLDOWN_SECONDS && last) {
    return { ok: false, reason: 'repetido', message: `Ya se registró la ${last.type} de ${student.firstName} hace un momento.`, student }
  }
  const type: CheckIn['type'] = !last || last.type === 'salida' ? 'entrada' : 'salida'
  const checkin: CheckIn = { id: uid('qr'), studentId: student.id, date: todayISO(), type, at: now, scannedBy: userKey(session), scannedByName: session.name, place }
  const hour = now.slice(11, 16)
  const notifications: AppNotification[] = student.guardianIds.map((g) => ({
    id: uid('nt'),
    userKey: `familia:${g}`,
    kind: type,
    title: type === 'entrada' ? `${student.firstName} entró a la escuela` : `${student.firstName} salió de la escuela`,
    body: `${type === 'entrada' ? 'Entrada' : 'Salida'} registrada con QR a las ${hour} en ${place}. ${groupLabel(db, student.groupId)}.`,
    link: `/familia/hijo/${student.id}?vista=dia`,
    studentId: student.id,
    at: now,
    readAt: null,
  }))
  return { ok: true, student, checkin, notifications }
}
