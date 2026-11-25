import type { Database, Level, SubjectColor, TableName } from './types'

/** Grados de cada nivel, con los mismos nombres que la escuela demo. */
export const GRADOS_POR_NIVEL: Record<Level, string[]> = {
  maternal: ['Maternal'],
  kinder: ['1° de kinder', '2° de kinder', '3° de kinder'],
  primaria: ['1° de primaria', '2° de primaria', '3° de primaria', '4° de primaria', '5° de primaria', '6° de primaria'],
  secundaria: ['1° de secundaria', '2° de secundaria', '3° de secundaria'],
  preparatoria: ['1° de preparatoria', '2° de preparatoria', '3° de preparatoria'],
}

const MATERIAS_POR_NIVEL: Record<Level, [string, SubjectColor][]> = {
  maternal: [['Desarrollo personal y social', 'ambar'], ['Lenguaje y comunicación', 'rojo'], ['Exploración del mundo', 'verde']],
  kinder: [['Lenguaje y comunicación', 'rojo'], ['Pensamiento matemático', 'azul'], ['Exploración del mundo', 'verde'], ['Artes', 'rosa']],
  primaria: [['Español', 'rojo'], ['Matemáticas', 'azul'], ['Ciencias Naturales', 'verde'], ['Historia', 'naranja'], ['Inglés', 'morado'], ['Educación Física', 'turquesa']],
  secundaria: [['Español', 'rojo'], ['Matemáticas', 'azul'], ['Ciencias', 'verde'], ['Historia', 'naranja'], ['Inglés', 'morado'], ['Educación Física', 'turquesa']],
  preparatoria: [['Matemáticas', 'azul'], ['Lectura y Redacción', 'rojo'], ['Física', 'indigo'], ['Historia', 'naranja'], ['Inglés', 'morado']],
}

export const TODAS_LAS_TABLAS: TableName[] = [
  'staff', 'cycles', 'periods', 'grades', 'groups', 'subjects', 'teachers', 'assignments', 'schedule', 'guardians', 'students',
  'attendance', 'gradeRecords', 'closures', 'homework', 'announcements', 'receipts', 'events', 'concepts', 'charges', 'payments',
  'reminders', 'invoices', 'audit', 'rooms', 'checkins', 'studentUpdates', 'chatThreads', 'chatMessages', 'notifications', 'cards',
]

/**
 * Datos con los que arranca una escuela que se da de alta sola: su nombre, el
 * ciclo escolar en curso con tres trimestres, los grados (con un grupo A) y materias de los
 * niveles que atiende y la ficha de su administrador. Todo lo demás, vacío.
 */
export function datosEscuelaNueva(o: { id: string; nombre: string; niveles: Level[]; correoContacto: string; admin: { id: string; nombre: string; correo: string }; hoy: Date }): Database {
  // El ciclo escolar empieza a fines de agosto: de enero a julio sigue el que empezó el año anterior.
  const y = o.hoy.getMonth() >= 7 ? o.hoy.getFullYear() : o.hoy.getFullYear() - 1
  const ciclo = { id: `c${y}`, name: `Ciclo ${y}-${y + 1}`, startDate: `${y}-08-24`, endDate: `${y + 1}-07-09`, active: true }
  const db = Object.fromEntries(TODAS_LAS_TABLAS.map((t) => [t, []])) as unknown as Database
  const niveles = (['maternal', 'kinder', 'primaria', 'secundaria', 'preparatoria'] as Level[]).filter((n) => o.niveles.includes(n))
  db.meta = {
    seedVersion: 1,
    school: { id: o.id, name: o.nombre, shortName: o.nombre, cct: '', rvoe: '', address: '', phone: '', email: o.correoContacto, demo: false },
    // La facturación sigue en modo demo (sin PAC real) hasta configurarla.
    cfdiConfig: { rfcEmisor: '', razonSocial: o.nombre.toUpperCase(), regimenFiscal: '601', codigoPostal: '', serie: 'A', nextFolio: 1, pacProvider: 'demo', demo: true },
    checkinPlaces: ['Puerta principal', 'Salón'],
  }
  db.staff = [{ id: o.admin.id, name: o.admin.nombre, position: 'Dirección', email: o.admin.correo }]
  db.cycles = [ciclo]
  db.periods = [
    { id: 'p1', cycleId: ciclo.id, name: '1er trimestre', startDate: `${y}-08-24`, endDate: `${y}-11-13` },
    { id: 'p2', cycleId: ciclo.id, name: '2º trimestre', startDate: `${y}-11-16`, endDate: `${y + 1}-03-12` },
    { id: 'p3', cycleId: ciclo.id, name: '3er trimestre', startDate: `${y + 1}-03-15`, endDate: `${y + 1}-07-09` },
  ]
  for (const n of niveles) {
    GRADOS_POR_NIVEL[n].forEach((name, i) => {
      db.grades.push({ id: `g-${n}-${i + 1}`, level: n, name, order: i + 1 })
      // Un grupo «A» por grado para poder inscribir desde el primer día (sin titular todavía).
      db.groups.push({ id: `gr-${n}-${i + 1}A`, gradeId: `g-${n}-${i + 1}`, cycleId: ciclo.id, name: 'A', homeroomTeacherId: '', room: '' })
    })
    MATERIAS_POR_NIVEL[n].forEach(([name, color], i) => db.subjects.push({ id: `s-${n}-${i + 1}`, name, level: n, color }))
  }
  return db
}
