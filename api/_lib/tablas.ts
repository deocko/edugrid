import type { TableName } from '../../src/data/types'

/**
 * Tablas de EDUGRID en la base de datos. El nombre de la izquierda es el que usa
 * la app (`src/data/types.ts`) y el de la derecha, el de la tabla en Postgres.
 * Si se agrega una tabla nueva en `types.ts`, TypeScript marca error aquí hasta
 * que también se agregue a esta lista.
 */
export const TABLAS = {
  staff: 'staff',
  cycles: 'cycles',
  periods: 'periods',
  grades: 'grades',
  groups: 'groups',
  subjects: 'subjects',
  teachers: 'teachers',
  assignments: 'assignments',
  schedule: 'schedule',
  guardians: 'guardians',
  students: 'students',
  attendance: 'attendance',
  gradeRecords: 'grade_records',
  closures: 'closures',
  homework: 'homework',
  announcements: 'announcements',
  receipts: 'receipts',
  events: 'events',
  concepts: 'concepts',
  charges: 'charges',
  payments: 'payments',
  reminders: 'reminders',
  invoices: 'invoices',
  audit: 'audit',
  rooms: 'rooms',
  checkins: 'checkins',
  studentUpdates: 'student_updates',
  chatThreads: 'chat_threads',
  chatMessages: 'chat_messages',
  notifications: 'notifications',
  cards: 'cards',
} as const satisfies Record<TableName, string>

export const NOMBRES_TABLAS = Object.keys(TABLAS) as TableName[]

export const esTabla = (valor: unknown): valor is TableName => typeof valor === 'string' && Object.hasOwn(TABLAS, valor)

/** Nombre de la tabla en Postgres, entre comillas para usarlo en SQL. */
export const tablaSql = (tabla: TableName): string => `"${TABLAS[tabla]}"`
