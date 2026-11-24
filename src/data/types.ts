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

export interface Subject {
  id: string
  name: string
  level: Level
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
}

export type TableName = keyof Tables

export type Database = { meta: Meta } & { [K in TableName]: Tables[K][] }

export interface Session {
  role: Role
  personId: string
  name: string
}
