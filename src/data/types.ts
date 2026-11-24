// Modelo de datos de EDUGRID. Todos los datos de la semilla son ficticios (DEMO).

export type Level = 'maternal' | 'kinder' | 'primaria' | 'secundaria' | 'preparatoria'
export type Role = 'admin' | 'docente' | 'familia' | 'alumno'

export interface School {
  id: string
  name: string
  shortName: string
  cct: string
  rvoe: string
  address: string
  phone: string
  email: string
  demo: true
}

export interface StaffMember {
  id: string
  name: string
  position: string
}

export interface Cycle {
  id: string
  name: string
  startDate: string
  endDate: string
  active: boolean
}

export interface Period {
  id: string
  cycleId: string
  name: string
  startDate: string
  endDate: string
}

export interface SchoolGrade {
  id: string
  level: Level
  name: string
  order: number
}

export interface Group {
  id: string
  gradeId: string
  cycleId: string
  name: string
  homeroomTeacherId: string
  room: string
}

export type SubjectColor = 'azul' | 'rojo' | 'verde' | 'naranja' | 'morado' | 'turquesa' | 'rosa' | 'ambar' | 'indigo' | 'gris'

export interface Subject {
  id: string
  name: string
  level: Level
  /** Color con el que se reconoce la materia en todas las pantallas y en la boleta. */
  color: SubjectColor
}

export interface TeachingAssignment {
  id: string
  groupId: string
  subjectId: string
  teacherId: string
}

export interface ScheduleSlot {
  id: string
  groupId: string
  subjectId: string
  teacherId: string
  day: number
  start: string
  end: string
}

export interface Teacher {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  specialty: string
  active: boolean
}

export interface Guardian {
  id: string
  firstName: string
  lastName: string
  relation: 'Madre' | 'Padre' | 'Tutor' | 'Tutora'
  email: string
  phone: string
  rfc: string
  taxName: string
  taxZip: string
  taxRegime: string
  consentAt: string | null
}

export interface Student {
  id: string
  firstName: string
  lastName: string
  birthDate: string
  curp: string
  groupId: string
  guardianIds: string[]
  enrollmentId: string
  status: 'activo' | 'baja'
  createdAt: string
  withdrawnAt?: string
  withdrawReason?: string
  /** Código opaco de su credencial QR (no contiene datos personales). */
  qrCode: string
  /** Foto del alumno (JPEG reducido, data URL). La sube la dirección. */
  photo?: string | null
}

export type AttendanceStatus = 'presente' | 'retardo' | 'falta' | 'justificada'

export interface AttendanceRecord {
  id: string
  groupId: string
  studentId: string
  date: string
  status: AttendanceStatus
  recordedBy: string
}

export interface GradeRecord {
  id: string
  studentId: string
  groupId: string
  subjectId: string
  periodId: string
  score: number
  updatedAt: string
}

export interface PeriodClosure {
  id: string
  groupId: string
  subjectId: string
  periodId: string
  closedAt: string
  closedBy: string
}

export interface Homework {
  id: string
  groupId: string
  subjectId: string
  title: string
  description: string
  assignedDate: string
  dueDate: string
  teacherId: string
}

export type Audience =
  | { type: 'escuela' }
  | { type: 'nivel'; level: Level }
  | { type: 'grupo'; groupId: string }

export interface Announcement {
  id: string
  kind: 'aviso' | 'mensaje'
  title: string
  body: string
  audience: Audience
  authorId: string
  authorName: string
  authorRole: Role
  createdAt: string
  requiresAck: boolean
}

export interface ReadReceipt {
  id: string
  announcementId: string
  userKey: string
  userName: string
  readAt: string
}

export interface SchoolEvent {
  id: string
  title: string
  date: string
  endDate?: string
  description: string
  audience: Audience
}

export type ConceptKind = 'inscripcion' | 'colegiatura' | 'otro'

export interface PaymentConcept {
  id: string
  name: string
  kind: ConceptKind
  amounts: Record<Level, number>
  satProductCode: string
  satUnitCode: string
  active: boolean
}

export interface Charge {
  id: string
  studentId: string
  conceptId: string
  description: string
  amount: number
  dueDate: string
  createdAt: string
}

export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta'

export interface Payment {
  id: string
  chargeId: string
  studentId: string
  amount: number
  method: PaymentMethod
  paidAt: string
  reference: string
  registeredBy: string
  invoiceId: string | null
}

export interface Reminder {
  id: string
  studentId: string
  guardianId: string
  message: string
  amount: number
  createdAt: string
  createdBy: string
}

export interface Invoice {
  id: string
  paymentId: string
  studentId: string
  serie: string
  folio: number
  uuid: string
  fecha: string
  fechaTimbrado: string
  total: number
  receptorRfc: string
  receptorNombre: string
  xml: string
  status: 'vigente' | 'cancelada'
  cancelReason?: string
  demo: true
}

export interface CfdiConfig {
  rfcEmisor: string
  razonSocial: string
  regimenFiscal: string
  codigoPostal: string
  serie: string
  nextFolio: number
  pacProvider: 'demo'
  demo: true
}

export interface AuditEntry {
  id: string
  at: string
  actorKey: string
  actorName: string
  role: Role
  action: string
  detail: string
  kind: 'acceso' | 'cambio' | 'denegado'
}

export interface Room {
  id: string
  name: string
  kind: 'salon' | 'laboratorio' | 'computo' | 'deportivo' | 'otro'
  capacity: number
  floor: string
  notes: string
}

/** Entrada o salida registrada al escanear la credencial QR. */
export interface CheckIn {
  id: string
  studentId: string
  date: string
  type: 'entrada' | 'salida'
  at: string
  scannedBy: string
  scannedByName: string
  place: string
}

export type UpdateCategory = 'llego' | 'comio' | 'participo' | 'logro' | 'necesita' | 'salud' | 'otro'

/** Novedad del día que la docente envía a la familia (con foto opcional). */
export interface StudentUpdate {
  id: string
  studentId: string
  teacherId: string
  teacherName: string
  at: string
  category: UpdateCategory
  text: string
  /** Foto comprimida (data URL JPEG). Solo la ven la familia del alumno, sus docentes y la dirección. */
  photo: string | null
}

export interface ChatThread {
  id: string
  teacherId: string
  guardianId: string
  studentId: string
  createdAt: string
}

export interface ChatMessage {
  id: string
  threadId: string
  fromKey: string
  fromName: string
  text: string
  at: string
  readAt: string | null
}

export interface AppNotification {
  id: string
  userKey: string
  kind: 'entrada' | 'salida' | 'estatus' | 'chat' | 'aviso'
  title: string
  body: string
  link: string
  studentId?: string
  at: string
  readAt: string | null
}

export interface Meta {
  seedVersion: number
  school: School
  cfdiConfig: CfdiConfig
}

/** Tablas que maneja el repositorio. Cada una es una lista de filas con `id`. */
export interface Tables {
  staff: StaffMember
  cycles: Cycle
  periods: Period
  grades: SchoolGrade
  groups: Group
  subjects: Subject
  teachers: Teacher
  assignments: TeachingAssignment
  schedule: ScheduleSlot
  guardians: Guardian
  students: Student
  attendance: AttendanceRecord
  gradeRecords: GradeRecord
  closures: PeriodClosure
  homework: Homework
  announcements: Announcement
  receipts: ReadReceipt
  events: SchoolEvent
  concepts: PaymentConcept
  charges: Charge
  payments: Payment
  reminders: Reminder
  invoices: Invoice
  audit: AuditEntry
  rooms: Room
  checkins: CheckIn
  studentUpdates: StudentUpdate
  chatThreads: ChatThread
  chatMessages: ChatMessage
  notifications: AppNotification
}

export type TableName = keyof Tables

export type Database = { meta: Meta } & { [K in TableName]: Tables[K][] }

export interface Session {
  role: Role
  personId: string
  name: string
}
