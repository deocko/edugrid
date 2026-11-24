// Genera src/data/seed.json con datos 100% ficticios (DEMO).
// Uso: node scripts/generate-seed.mjs
import { writeFileSync } from 'node:fs'

let s = 20261123
const rnd = () => {
  s |= 0; s = (s + 0x6d2b79f5) | 0
  let t = Math.imul(s ^ (s >>> 15), 1 | s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = (a) => a[Math.floor(rnd() * a.length)]
const pad = (n, l = 2) => String(n).padStart(l, '0')
const iso = (d) => d.toISOString().slice(0, 10)

const girls = ['Valentina','Regina','Sofía','Camila','Ximena','Renata','María José','Natalia','Fernanda','Romina','Paula','Daniela','Isabella','Mariana','Andrea','Victoria','Lucía','Ana Paula','Emilia','Jimena']
const boys = ['Santiago','Mateo','Sebastián','Leonardo','Emiliano','Diego','Iker','Rodrigo','Daniel','Alejandro','Emilio','Tomás','Gael','Andrés','Joaquín','Nicolás','Bruno','Julián','Luis Ángel','Patricio']
const adultsF = ['Laura','Gabriela','Adriana','Verónica','Claudia','Mónica','Alejandra','Patricia','Rocío','Karla','Elena','Silvia','Lorena','Beatriz','Carmen']
const adultsM = ['Jorge','Ricardo','Arturo','Fernando','Javier','Eduardo','Héctor','Raúl','Óscar','Manuel','Sergio','Alberto','Roberto','Miguel','Gerardo']
const surnames = ['Méndez','Ortega','Salinas','Herrera','Cervantes','Ibarra','Villalobos','Escobedo','Navarro','Robles','Aguilar','Quintero','Montes','Bautista','Carrillo','Zamora','Fuentes','Delgado','Lozano','Paredes','Rosales','Valdez','Cordero','Espinoza','Galindo','Treviño','Medina','Arellano','Sandoval','Barrera']

// Día simulado de la demo: martes 24 de noviembre de 2026 (igual que DEMO_TODAY en src/lib/format.ts)
const today = new Date('2026-11-24T12:00:00')

// Niveles, grados y grupos
const levelDefs = [
  { level: 'maternal', grades: ['Maternal'], age: 2 },
  { level: 'kinder', grades: ['1° de kinder', '2° de kinder', '3° de kinder'], age: 3 },
  { level: 'primaria', grades: ['1° de primaria','2° de primaria','3° de primaria','4° de primaria','5° de primaria','6° de primaria'], age: 6 },
  { level: 'secundaria', grades: ['1° de secundaria','2° de secundaria','3° de secundaria'], age: 12 },
  { level: 'preparatoria', grades: ['1° de preparatoria','2° de preparatoria','3° de preparatoria'], age: 15 },
]
const subjectsByLevel = {
  maternal: ['Desarrollo personal y social', 'Lenguaje y comunicación', 'Exploración del mundo'],
  kinder: ['Lenguaje y comunicación', 'Pensamiento matemático', 'Exploración del mundo', 'Artes'],
  primaria: ['Español', 'Matemáticas', 'Ciencias Naturales', 'Historia', 'Inglés', 'Educación Física'],
  secundaria: ['Español', 'Matemáticas', 'Ciencias', 'Historia', 'Inglés', 'Educación Física'],
  preparatoria: ['Matemáticas', 'Lectura y Redacción', 'Física', 'Historia', 'Inglés'],
}

// Mismo color para la misma materia en todos los niveles.
const SUBJECT_COLOR = {
  'Español': 'rojo', 'Lenguaje y comunicación': 'rojo', 'Lectura y Redacción': 'rojo',
  'Matemáticas': 'azul', 'Pensamiento matemático': 'azul',
  'Ciencias Naturales': 'verde', 'Ciencias': 'verde', 'Exploración del mundo': 'verde',
  'Física': 'indigo', 'Historia': 'naranja', 'Inglés': 'morado',
  'Educación Física': 'turquesa', 'Artes': 'rosa', 'Desarrollo personal y social': 'ambar',
}

const cycle = { id: 'c2026', name: 'Ciclo 2026-2027', startDate: '2026-08-24', endDate: '2027-07-09', active: true }
const cycles = [{ id: 'c2025', name: 'Ciclo 2025-2026', startDate: '2025-08-25', endDate: '2026-07-10', active: false }, cycle]
const periods = [
  { id: 'p1', cycleId: 'c2026', name: '1er trimestre', startDate: '2026-08-24', endDate: '2026-11-13' },
  { id: 'p2', cycleId: 'c2026', name: '2º trimestre', startDate: '2026-11-16', endDate: '2027-03-12' },
  { id: 'p3', cycleId: 'c2026', name: '3er trimestre', startDate: '2027-03-15', endDate: '2027-07-09' },
]

const grades = [], groups = [], subjects = [], teachers = [], assignments = []
let tCount = 0
const mkTeacher = (specialty, female) => {
  tCount++
  const fn = female ? pick(adultsF) : pick(adultsM)
  const t = { id: `t${tCount}`, firstName: fn, lastName: `${pick(surnames)} ${pick(surnames)}`, email: `docente${tCount}@demo.edugrid.mx`, phone: `55 0000 ${pad(tCount, 4)}`, specialty, active: true }
  teachers.push(t); return t
}
for (const def of levelDefs) for (const name of subjectsByLevel[def.level]) subjects.push({ id: `s-${def.level}-${subjects.length + 1}`, name, level: def.level, color: SUBJECT_COLOR[name] ?? 'gris' })

const subjFor = (level) => subjects.filter((x) => x.level === level)
// Docentes por materia para secundaria y prepa
const subjectTeachers = {
  'Español': mkTeacher('Español y Lectura', true), 'Matemáticas': mkTeacher('Matemáticas', false),
  'Ciencias': mkTeacher('Ciencias y Física', true), 'Historia': mkTeacher('Historia', false),
  'Inglés': mkTeacher('Inglés', true), 'Educación Física': mkTeacher('Educación Física', false),
}
subjectTeachers['Lectura y Redacción'] = subjectTeachers['Español']
subjectTeachers['Física'] = subjectTeachers['Ciencias']
const tutorRotation = ['Español','Matemáticas','Ciencias','Historia','Inglés','Matemáticas']
let rot = 0
for (const def of levelDefs) {
  def.grades.forEach((gname, i) => {
    const grade = { id: `g-${def.level}-${i + 1}`, level: def.level, name: gname, order: i + 1 }
    grades.push(grade)
    let homeroom
    if (def.level === 'secundaria' || def.level === 'preparatoria') homeroom = subjectTeachers[tutorRotation[rot++]]
    else homeroom = mkTeacher(def.level === 'primaria' ? 'Educación primaria' : 'Educación preescolar', rnd() > 0.2)
    const group = { id: `gr-${def.level}-${i + 1}A`, gradeId: grade.id, cycleId: cycle.id, name: 'A', homeroomTeacherId: homeroom.id, room: `Salón ${groups.length + 101}` }
    groups.push(group)
    for (const sub of subjFor(def.level)) {
      let teacherId = homeroom.id
      if (subjectTeachers[sub.name] && (def.level === 'secundaria' || def.level === 'preparatoria' || sub.name === 'Inglés' || sub.name === 'Educación Física')) teacherId = subjectTeachers[sub.name].id
      assignments.push({ id: `a${assignments.length + 1}`, groupId: group.id, subjectId: sub.id, teacherId })
    }
  })
}

// Horarios (lunes a viernes)
const schedule = []
const times = [['08:00','08:50'],['08:50','09:40'],['09:40','10:30'],['11:00','11:50'],['11:50','12:40'],['12:40','13:30']]
for (const g of groups) {
  const as = assignments.filter((a) => a.groupId === g.id)
  const level = grades.find((x) => x.id === g.gradeId).level
  const slots = level === 'maternal' || level === 'kinder' ? 3 : level === 'primaria' ? 5 : 6
  for (let day = 1; day <= 5; day++) for (let k = 0; k < slots; k++) {
    const a = as[(day + k) % as.length]
    schedule.push({ id: `h${schedule.length + 1}`, groupId: g.id, subjectId: a.subjectId, teacherId: a.teacherId, day, start: times[k][0], end: times[k][1] })
  }
}

// Familias y alumnos
const guardians = [], students = []
const regimes = ['605', '612', '626', '606']
const mkRfc = (fn, ln, y) => `${ln.slice(0, 2).toUpperCase()}${fn[0].toUpperCase()}${ln.split(' ')[1]?.[0]?.toUpperCase() ?? 'X'}${pad(y % 100)}${pad(1 + Math.floor(rnd() * 12))}${pad(1 + Math.floor(rnd() * 28))}${pick(['A','B','C','D'])}${pick(['1','2','3','4'])}${Math.floor(rnd() * 10)}`
const norm = (x) => x.normalize('NFD').replace(/[̀-ͯ]/g, '')
const mkGuardian = (female, last) => {
  const fn = female ? pick(adultsF) : pick(adultsM)
  const ln = `${last} ${pick(surnames)}`
  const id = `tu${guardians.length + 1}`
  const g = { id, firstName: fn, lastName: ln, relation: female ? 'Madre' : 'Padre', email: `familia${guardians.length + 1}@demo.edugrid.mx`, phone: `55 1000 ${pad(guardians.length + 1, 4)}`,
    rfc: mkRfc(norm(fn), norm(ln), 1980 + Math.floor(rnd() * 12)), taxName: `${fn} ${ln}`.toUpperCase(), taxZip: pick(['03100','04510','06700','11560','14000']), taxRegime: pick(regimes), consentAt: rnd() > 0.15 ? '2026-08-10T10:00:00' : null }
  guardians.push(g); return g
}
let matricula = 1
const mkStudent = (group, fam, forced) => {
  const grade = grades.find((x) => x.id === group.gradeId)
  const def = levelDefs.find((d) => d.level === grade.level)
  const female = forced ? forced.female : rnd() > 0.5
  const ln = `${fam.last} ${fam.second}`
  let fn = forced ? forced.name : female ? pick(girls) : pick(boys)
  // Nombres completos únicos: dos alumnos distintos nunca se llaman igual
  while (!forced && students.some((x) => x.firstName === fn && x.lastName === ln)) fn = female ? pick(girls) : pick(boys)
  const age = def.age + grade.order - 1
  const by = 2026 - age - (rnd() > 0.6 ? 1 : 0)
  const bd = `${by}-${pad(1 + Math.floor(rnd() * 12))}-${pad(1 + Math.floor(rnd() * 28))}`
  const n = norm
  const curp = `${n(fam.last).slice(0, 2).toUpperCase()}${n(fam.second)[0].toUpperCase()}${n(fn)[0].toUpperCase()}${bd.slice(2, 4)}${bd.slice(5, 7)}${bd.slice(8, 10)}${female ? 'M' : 'H'}DF${'BCDFGLMNPRST'[Math.floor(rnd() * 12)]}${'BCDFGLMNPRST'[Math.floor(rnd() * 12)]}${'BCDFGLMNPRST'[Math.floor(rnd() * 12)]}0${Math.floor(rnd() * 10)}`
  const st = { id: `al${students.length + 1}`, firstName: fn, lastName: ln, birthDate: bd, curp, groupId: group.id, guardianIds: fam.guardianIds, enrollmentId: `DEMO-${pad(matricula++, 4)}`, status: 'activo', createdAt: '2026-08-10T09:00:00' }
  students.push(st); return st
}
const famFor = () => {
  const last = pick(surnames), second = pick(surnames)
  const mom = mkGuardian(true, second)
  const ids = [mom.id]
  if (rnd() > 0.35) ids.push(mkGuardian(false, last).id)
  return { last, second, guardianIds: ids }
}
// Familia demo principal: Regina (4° de primaria A) y Mateo (2° de primaria A)
const demoFam = { last: 'Méndez', second: 'Ortega', guardianIds: [] }
const demoMom = { id: 'tu0', firstName: 'Laura', lastName: 'Ortega Salinas', relation: 'Madre', email: 'familia.demo@demo.edugrid.mx', phone: '55 1000 0000', rfc: 'OESL850412AB1', taxName: 'LAURA ORTEGA SALINAS', taxZip: '03100', taxRegime: '612', consentAt: '2026-08-10T10:00:00' }
guardians.push(demoMom); demoFam.guardianIds = ['tu0']
const grp = (lvl, n) => groups.find((g) => g.id === `gr-${lvl}-${n}A`)
mkStudent(grp('primaria', 4), demoFam, { name: 'Regina', female: true })
mkStudent(grp('primaria', 2), demoFam, { name: 'Mateo', female: false })
// Resto de grupos: 4 alumnos por grupo (algunos hermanos)
const families = []
for (const g of groups) {
  const current = students.filter((x) => x.groupId === g.id).length
  for (let k = current; k < 4; k++) {
    let fam
    if (families.length > 3 && rnd() < 0.18) fam = pick(families)
    else { fam = famFor(); families.push(fam) }
    mkStudent(g, fam)
  }
}

// Asistencia: últimos 10 días hábiles
const attendance = []
const schoolDays = []
for (let d = new Date(today); schoolDays.length < 10; d.setDate(d.getDate() - 1)) {
  const wd = d.getDay()
  if (wd === 0 || wd === 6) continue
  if (iso(d) === '2026-11-16' || iso(d) === iso(today)) continue // asueto y día actual (aún sin pase de lista)
  schoolDays.push(iso(d))
}
// Asistencia fija de la familia demo para que coincida en todas las vistas:
// Regina: 8 asistencias, 1 retardo y 1 falta (90%). Mateo: 9 asistencias y 1 retardo (100%).
const fixedAttendance = {
  al1: { [schoolDays[2]]: 'falta', [schoolDays[6]]: 'retardo' },
  al2: { [schoolDays[4]]: 'retardo' },
}
for (const st of students) for (const day of schoolDays) {
  const r = rnd()
  const fixed = fixedAttendance[st.id]
  const status = fixed ? (fixed[day] ?? 'presente') : r < 0.86 ? 'presente' : r < 0.92 ? 'retardo' : r < 0.97 ? 'falta' : 'justificada'
  const g = groups.find((x) => x.id === st.groupId)
  attendance.push({ id: `as${attendance.length + 1}`, groupId: g.id, studentId: st.id, date: day, status, recordedBy: g.homeroomTeacherId })
}

// Calificaciones: 1er trimestre completo y cerrado
const REGINA_P1 = { 'Español': 8.8, 'Matemáticas': 8.2, 'Ciencias Naturales': 8.6, 'Historia': 8.0, 'Inglés': 8.4, 'Educación Física': 9.0 }
const gradeRecords = [], closures = []
for (const g of groups) {
  const level = grades.find((x) => x.id === g.gradeId).level
  const preschool = level === 'maternal' || level === 'kinder'
  for (const a of assignments.filter((x) => x.groupId === g.id)) {
    for (const st of students.filter((x) => x.groupId === g.id)) {
      let score = preschool ? 2 + Math.floor(rnd() * 3) : Math.min(10, Math.max(6, Math.round((7 + rnd() * 3.4) * 10) / 10))
      // Regina (caso de referencia de la revisión): promedio 8.5 en el 1er trimestre
      const fixed = st.id === 'al1' ? REGINA_P1[subjects.find((x) => x.id === a.subjectId)?.name] : undefined
      if (fixed !== undefined) score = fixed
      gradeRecords.push({ id: `cal${gradeRecords.length + 1}`, studentId: st.id, groupId: g.id, subjectId: a.subjectId, periodId: 'p1', score, updatedAt: '2026-11-12T18:00:00' })
    }
    closures.push({ id: `ci${closures.length + 1}`, groupId: g.id, subjectId: a.subjectId, periodId: 'p1', closedAt: '2026-11-13T19:00:00', closedBy: a.teacherId })
  }
}

// Tareas: propias de cada grado, con vencimientos repartidos (máximo 2 por día por grupo)
const homework = []
const hwByLevel = {
  maternal: { 'Lenguaje y comunicación': ['Traer un cuento favorito para compartir'], 'Exploración del mundo': ['Traer una hoja de árbol'] },
  kinder: { 'Lenguaje y comunicación': ['Traer un cuento favorito para compartir'], 'Pensamiento matemático': ['Contar objetos en casa y dibujarlos'], 'Artes': ['Dibujo de la familia'] },
  'primaria-1': { 'Español': ['Lectura en voz alta con un adulto', 'Copiar 5 palabras con m y p'], 'Matemáticas': ['Sumas sencillas hasta el 20'], 'Ciencias Naturales': ['Dibujar los cinco sentidos'] },
  'primaria-2': { 'Español': ['Lectura en voz alta: 10 minutos diarios', 'Ortografía: palabras con r y rr'], 'Matemáticas': ['Sumas y restas con llevar', 'Tablas del 2 y del 5'], 'Ciencias Naturales': ['Dibujar las partes de una planta'] },
  'primaria-3': { 'Español': ['Lectura de comprensión, página 32', 'Ortografía: uso de mayúsculas'], 'Matemáticas': ['Multiplicaciones de una cifra', 'Problemas de suma y resta'], 'Ciencias Naturales': ['Cuidado del agua en casa'], 'Historia': ['Entrevista a un abuelo sobre su infancia'] },
  'primaria-4': { 'Español': ['Lectura de comprensión: «El ratón del supermercado»', 'Ortografía: palabras con b y v'], 'Matemáticas': ['Multiplicaciones de dos cifras, página 48', 'Problemas de reparto con división'], 'Ciencias Naturales': ['Maqueta del sistema digestivo'], 'Historia': ['Línea del tiempo de los pueblos mesoamericanos'] },
  'primaria-5': { 'Español': ['Resumen de un texto informativo', 'Ortografía: acentuación de palabras agudas'], 'Matemáticas': ['Fracciones equivalentes, página 54', 'Problemas con decimales'], 'Ciencias Naturales': ['Esquema del aparato respiratorio'], 'Historia': ['Línea del tiempo de la Independencia'] },
  'primaria-6': { 'Español': ['Reseña de un libro', 'Ortografía: uso de la h'], 'Matemáticas': ['Porcentajes en ofertas del súper', 'Área y perímetro de figuras'], 'Ciencias Naturales': ['Cartel sobre el reciclaje'], 'Historia': ['Línea del tiempo de la Revolución Mexicana'] },
  secundaria: { 'Español': ['Redacta una carta formal', 'Lectura de un cuento latinoamericano'], 'Matemáticas': ['Problemas de ecuaciones lineales', 'Repaso para examen del bloque'], 'Ciencias': ['Reporte de práctica de laboratorio'], 'Historia': ['Línea del tiempo de la Revolución Mexicana'], 'Inglés': ['Lista de vocabulario de la unidad 4'] },
  preparatoria: { 'Lectura y Redacción': ['Ensayo argumentativo de una cuartilla'], 'Matemáticas': ['Problemas de funciones cuadráticas'], 'Física': ['Problemas de movimiento rectilíneo'], 'Historia': ['Ensayo sobre el México contemporáneo'], 'Inglés': ['Presentación oral de la unidad 4'] },
}
// Días de entrega a partir del día simulado (sin fines de semana ni el viernes 27, día de Consejo Técnico)
const dueDays = ['2026-11-25', '2026-11-26', '2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04']
for (const g of groups) {
  const grade = grades.find((x) => x.id === g.gradeId)
  const key = grade.level === 'primaria' ? `primaria-${grade.order}` : grade.level
  const table = hwByLevel[key] ?? {}
  const items = []
  for (const a of assignments.filter((x) => x.groupId === g.id)) {
    const sub = subjects.find((x) => x.id === a.subjectId)
    for (const title of table[sub.name] ?? []) items.push({ a, sub, title })
  }
  // Reparte: máximo 2 tareas por día para el grupo
  items.forEach((it, idx) => {
    const due = dueDays[(Math.floor(idx / 2) + (grade.order % 2)) % dueDays.length]
    homework.push({ id: `ta${homework.length + 1}`, groupId: g.id, subjectId: it.sub.id, title: it.title, description: 'Entregar en clase. Cualquier duda, pregunta a tu maestra o maestro.', assignedDate: '2026-11-20', dueDate: due, teacherId: it.a.teacherId })
  })
}

// Avisos y mensajes
const staff = [
  { id: 'adm1', name: 'Mtra. Patricia Ruiz', position: 'Dirección general' },
  { id: 'adm2', name: 'Lic. Andrés Cabrera', position: 'Administración y finanzas' },
]
const announcements = [
  { id: 'av1', kind: 'aviso', title: 'Junta de Consejo Técnico: no hay clases', body: 'El viernes 27 de noviembre no habrá clases por la sesión de Consejo Técnico Escolar. Las actividades se reanudan el lunes 30.', audience: { type: 'escuela' }, authorId: 'adm1', authorName: 'Mtra. Patricia Ruiz', authorRole: 'admin', createdAt: '2026-11-20T09:00:00', requiresAck: true },
  { id: 'av2', kind: 'aviso', title: 'Festival de invierno', body: 'Les invitamos al festival de invierno el sábado 12 de diciembre a las 10:00 en el patio principal. Cada grupo presentará un número.', audience: { type: 'escuela' }, authorId: 'adm1', authorName: 'Mtra. Patricia Ruiz', authorRole: 'admin', createdAt: '2026-11-18T12:00:00', requiresAck: false },
  { id: 'av3', kind: 'aviso', title: 'Recordatorio de colegiatura de noviembre', body: 'La colegiatura de noviembre vence el día 10. Si ya pagaste, gracias. Puedes consultar tu estado de cuenta en el portal.', audience: { type: 'escuela' }, authorId: 'adm2', authorName: 'Lic. Andrés Cabrera', authorRole: 'admin', createdAt: '2026-11-05T08:00:00', requiresAck: false },
  { id: 'av4', kind: 'aviso', title: 'Campaña de vacunación en preescolar', body: 'El martes 1 de diciembre habrá campaña de vacunación para maternal y kinder. Firma y entrega el formato de autorización.', audience: { type: 'nivel', level: 'kinder' }, authorId: 'adm1', authorName: 'Mtra. Patricia Ruiz', authorRole: 'admin', createdAt: '2026-11-19T10:00:00', requiresAck: true },
  { id: 'av5', kind: 'aviso', title: 'Feria de ciencias de secundaria', body: 'Los equipos de secundaria presentarán sus proyectos el jueves 3 de diciembre. Familias bienvenidas de 9:00 a 11:00.', audience: { type: 'nivel', level: 'secundaria' }, authorId: 'adm1', authorName: 'Mtra. Patricia Ruiz', authorRole: 'admin', createdAt: '2026-11-17T10:00:00', requiresAck: false },
]
const g4 = grp('primaria', 4), s2 = grp('secundaria', 2)
announcements.push(
  { id: 'm1', kind: 'mensaje', title: 'Material para la clase del miércoles', body: 'Por favor envíen una caja de zapatos y pegamento para el proyecto de Ciencias Naturales.', audience: { type: 'grupo', groupId: g4.id }, authorId: g4.homeroomTeacherId, authorName: '', authorRole: 'docente', createdAt: '2026-11-21T14:00:00', requiresAck: true },
  { id: 'm2', kind: 'mensaje', title: 'Examen de Matemáticas', body: 'El examen del bloque será el lunes 30. Repasen las páginas 40 a 52.', audience: { type: 'grupo', groupId: s2.id }, authorId: subjectTeachers['Matemáticas'].id, authorName: '', authorRole: 'docente', createdAt: '2026-11-20T16:00:00', requiresAck: true },
)
for (const a of announcements) if (!a.authorName) { const t = teachers.find((x) => x.id === a.authorId); a.authorName = `${t.firstName} ${t.lastName}` }
const receipts = [
  { id: 'rr1', announcementId: 'av2', userKey: 'familia:tu0', userName: 'Laura Ortega Salinas', readAt: '2026-11-18T20:00:00' },
  { id: 'rr2', announcementId: 'av3', userKey: 'familia:tu0', userName: 'Laura Ortega Salinas', readAt: '2026-11-05T21:00:00' },
]
for (const gu of guardians.slice(1, 25)) if (rnd() > 0.4) receipts.push({ id: `rr${receipts.length + 1}`, announcementId: 'av1', userKey: `familia:${gu.id}`, userName: `${gu.firstName} ${gu.lastName}`, readAt: '2026-11-20T19:00:00' })

const events = [
  { id: 'ev1', title: 'Junta de Consejo Técnico (sin clases)', date: '2026-11-27', description: 'Suspensión de clases para alumnos.', audience: { type: 'escuela' } },
  { id: 'ev2', title: 'Feria de ciencias', date: '2026-12-03', description: 'Proyectos de secundaria.', audience: { type: 'nivel', level: 'secundaria' } },
  { id: 'ev3', title: 'Campaña de vacunación', date: '2026-12-01', description: 'Maternal y kinder.', audience: { type: 'nivel', level: 'kinder' } },
  { id: 'ev4', title: 'Vence colegiatura de diciembre', date: '2026-12-10', description: 'Fecha límite de pago.', audience: { type: 'escuela' } },
  { id: 'ev5', title: 'Festival de invierno', date: '2026-12-12', description: 'Patio principal, 10:00.', audience: { type: 'escuela' } },
  { id: 'ev6', title: 'Vacaciones de invierno', date: '2026-12-21', endDate: '2027-01-06', description: 'Regreso a clases el 7 de enero.', audience: { type: 'escuela' } },
  { id: 'ev7', title: 'Entrega de boletas del 1er trimestre', date: '2026-11-26', description: 'Consulta las calificaciones en el portal.', audience: { type: 'escuela' } },
]

// Pagos
const concepts = [
  { id: 'cp1', name: 'Inscripción 2026-2027', kind: 'inscripcion', amounts: { maternal: 4500, kinder: 5200, primaria: 6200, secundaria: 6900, preparatoria: 7400 }, satProductCode: '86121500', satUnitCode: 'E48', active: true },
  { id: 'cp2', name: 'Colegiatura mensual', kind: 'colegiatura', amounts: { maternal: 3900, kinder: 4300, primaria: 5100, secundaria: 5800, preparatoria: 6300 }, satProductCode: '86121500', satUnitCode: 'E48', active: true },
  { id: 'cp3', name: 'Cuota de materiales', kind: 'otro', amounts: { maternal: 900, kinder: 1100, primaria: 1400, secundaria: 1500, preparatoria: 1600 }, satProductCode: '86121500', satUnitCode: 'E48', active: true },
  { id: 'cp4', name: 'Seguro escolar', kind: 'otro', amounts: { maternal: 650, kinder: 650, primaria: 650, secundaria: 650, preparatoria: 650 }, satProductCode: '84131500', satUnitCode: 'E48', active: true },
]
const charges = [], payments = []
const months = [['Septiembre', '2026-09-10'], ['Octubre', '2026-10-10'], ['Noviembre', '2026-11-10'], ['Diciembre', '2026-12-10']]
const methods = ['efectivo', 'transferencia', 'tarjeta']
const pay = (ch, amount, date) => payments.push({ id: `pg${payments.length + 1}`, chargeId: ch.id, studentId: ch.studentId, amount, method: pick(methods), paidAt: date, reference: '', registeredBy: 'adm2', invoiceId: null })
for (const st of students) {
  const level = grades.find((x) => x.id === groups.find((g) => g.id === st.groupId).gradeId).level
  const add = (conceptId, description, dueDate) => { const c = concepts.find((x) => x.id === conceptId); const ch = { id: `cg${charges.length + 1}`, studentId: st.id, conceptId, description, amount: c.amounts[level], dueDate, createdAt: '2026-08-01T09:00:00' }; charges.push(ch); return ch }
  pay(add('cp1', 'Inscripción ciclo 2026-2027', '2026-08-15'), concepts[0].amounts[level], '2026-08-0' + (1 + Math.floor(rnd() * 9)))
  pay(add('cp3', 'Cuota de materiales 2026-2027', '2026-08-31'), concepts[2].amounts[level], '2026-08-2' + Math.floor(rnd() * 9))
  months.forEach(([m, due], i) => {
    const ch = add('cp2', `Colegiatura de ${m.toLowerCase()} 2026`, due)
    const r = rnd()
    const late = st.id === 'al2' && i === 2 // deja un adeudo en la familia demo
    if (i === 0 || (i === 1 && r < 0.88) || (i === 2 && r < 0.55 && !late)) pay(ch, ch.amount, due.replace(/-10$/, '-0' + (2 + Math.floor(rnd() * 7))))
    else if (i === 2 && r < 0.7 && !late) pay(ch, Math.round(ch.amount / 2), '2026-11-08')
  })
}
// Referencias: todos los pagos llevan REF-DEMO consecutiva, en orden de fecha, sin huecos
;[...payments].sort((a, b) => a.paidAt.localeCompare(b.paidAt) || Number(a.id.slice(2)) - Number(b.id.slice(2))).forEach((p, i) => { p.reference = `REF-DEMO-${1000 + i}` })
const reminders = []

const audit = [
  { id: 'lg1', at: '2026-11-20T09:00:00', actorKey: 'admin:adm1', actorName: 'Mtra. Patricia Ruiz', role: 'admin', action: 'Publicó un aviso', detail: 'Junta de Consejo Técnico: no hay clases', kind: 'cambio' },
]

// Aulas: los salones de cada grupo y espacios comunes
const rooms = groups.map((g, i) => ({ id: `au${i + 1}`, name: g.room, kind: 'salon', capacity: grades.find((x) => x.id === g.gradeId).level === 'maternal' ? 12 : 30, floor: i < 8 ? 'Planta baja' : 'Primer piso', notes: '' }))
rooms.push(
  { id: `au${rooms.length + 1}`, name: 'Laboratorio de ciencias', kind: 'laboratorio', capacity: 24, floor: 'Primer piso', notes: 'Batas y lentes de seguridad' },
  { id: `au${rooms.length + 2}`, name: 'Sala de cómputo', kind: 'computo', capacity: 28, floor: 'Primer piso', notes: '' },
  { id: `au${rooms.length + 3}`, name: 'Patio y cancha', kind: 'deportivo', capacity: 120, floor: 'Planta baja', notes: '' },
)

// Código QR de cada alumno: identificador opaco (no lleva nombre ni datos personales)
const QR_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const usedCodes = new Set()
for (const st of students) {
  let code
  do code = Array.from({ length: 8 }, () => QR_ALPHABET[Math.floor(rnd() * QR_ALPHABET.length)]).join('')
  while (usedCodes.has(code))
  usedCodes.add(code)
  st.qrCode = code
}

// Entradas y salidas con QR: ayer completas y hoy solo entradas (4° A y 2° A de primaria)
const checkins = [], notifications = []
const keyOf = (st) => st.guardianIds.map((g) => `familia:${g}`)
const qrGroups = ['gr-primaria-4A', 'gr-primaria-2A']
const fixedIn = { al1: '07:42', al2: '07:44' }
for (const [date, withExit] of [['2026-11-23', true], ['2026-11-24', false]]) {
  for (const st of students.filter((x) => qrGroups.includes(x.groupId) && x.status === 'activo')) {
    const tin = fixedIn[st.id] ?? `07:${pad(30 + Math.floor(rnd() * 25))}`
    checkins.push({ id: `qr${checkins.length + 1}`, studentId: st.id, date, type: 'entrada', at: `${date}T${tin}:00`, scannedBy: 'admin:adm1', scannedByName: 'Mtra. Patricia Ruiz', place: 'Puerta principal' })
    if (withExit) checkins.push({ id: `qr${checkins.length + 1}`, studentId: st.id, date, type: 'salida', at: `${date}T14:${pad(5 + Math.floor(rnd() * 20))}:00`, scannedBy: 'admin:adm1', scannedByName: 'Mtra. Patricia Ruiz', place: 'Puerta principal' })
  }
}
const regina = students.find((x) => x.id === 'al1'), mateo = students.find((x) => x.id === 'al2')
for (const c of checkins.filter((x) => x.date === '2026-11-24' && (x.studentId === 'al1' || x.studentId === 'al2'))) {
  const st = c.studentId === 'al1' ? regina : mateo
  for (const k of keyOf(st)) notifications.push({ id: `nt${notifications.length + 1}`, userKey: k, kind: 'entrada', title: `${st.firstName} entró a la escuela`, body: `Entrada registrada con QR a las ${c.at.slice(11, 16)} en Puerta principal.`, link: `/familia/hijo/${st.id}?vista=dia`, studentId: st.id, at: c.at, readAt: '2026-11-24T08:30:00' })
}

// Estatus del día que envían las docentes a las familias
const mateoTeacher = groups.find((g) => g.id === mateo.groupId).homeroomTeacherId
const tName = (id) => { const t = teachers.find((x) => x.id === id); return `${t.firstName} ${t.lastName}` }
const studentUpdates = [
  { id: 'es1', studentId: 'al2', teacherId: mateoTeacher, teacherName: tName(mateoTeacher), at: '2026-11-23T12:10:00', category: 'comio', text: 'Mateo comió todo su refrigerio y jugó muy bien con sus compañeros en el recreo.', photo: null },
  { id: 'es2', studentId: 'al1', teacherId: 't14', teacherName: tName('t14'), at: '2026-11-24T10:45:00', category: 'logro', text: 'Regina explicó su avance de la maqueta del sistema digestivo frente al grupo. ¡Muy bien!', photo: null },
]
for (const u of studentUpdates) {
  const st = u.studentId === 'al1' ? regina : mateo
  for (const k of keyOf(st)) notifications.push({ id: `nt${notifications.length + 1}`, userKey: k, kind: 'estatus', title: `Novedad de ${st.firstName}`, body: `${u.teacherName}: ${u.text}`, link: `/familia/hijo/${st.id}?vista=dia`, studentId: st.id, at: u.at, readAt: u.id === 'es1' ? '2026-11-23T13:00:00' : null })
}

// Chat entre la titular de 4° A y la mamá de Regina
const laura = guardians.find((g) => g.id === 'tu0') ?? guardians.find((g) => regina.guardianIds.includes(g.id))
const chatThreads = [{ id: 'ch1', teacherId: 't14', guardianId: laura.id, studentId: 'al1', createdAt: '2026-11-23T18:20:00' }]
const chatMessages = [
  { id: 'cm1', threadId: 'ch1', fromKey: `familia:${laura.id}`, fromName: `${laura.firstName} ${laura.lastName}`, text: 'Buenas tardes, maestra. ¿Regina tiene que llevar material para la maqueta?', at: '2026-11-23T18:20:00', readAt: '2026-11-23T19:00:00' },
  { id: 'cm2', threadId: 'ch1', fromKey: 'docente:t14', fromName: tName('t14'), text: 'Hola, Laura. Sí: plastilina de colores y una base de cartón de 30 × 30 cm. ¡Gracias!', at: '2026-11-23T19:05:00', readAt: '2026-11-23T20:10:00' },
]

const db = {
  meta: {
    seedVersion: 5,
    school: { id: 'esc1', name: 'Colegio Demo EDUGRID', shortName: 'Colegio Demo', cct: 'DEMO-CCT-0000', rvoe: 'DEMO-RVOE-0000', address: 'Av. Ejemplo 123, Col. Demostración, Ciudad de México (DEMO)', phone: '55 0000 0000', email: 'contacto@demo.edugrid.mx', demo: true },
    cfdiConfig: { rfcEmisor: 'DEMO123456T78', razonSocial: 'COLEGIO DEMO EDUGRID S.A. DE C.V.', regimenFiscal: '601', codigoPostal: '03100', serie: 'CFDI-DEMO', nextFolio: 1, pacProvider: 'demo', demo: true },
    branding: { logo: null, primary: '#1769d2', accent: '#35c5d9' },
    checkinPlaces: ['Puerta principal', 'Puerta de preescolar', 'Salón'],
  },
  staff, cycles, periods, grades, groups, subjects, teachers, assignments, schedule, guardians, students,
  attendance, gradeRecords, closures, homework, announcements, receipts, events, concepts, charges, payments, reminders, invoices: [], audit,
  rooms, checkins, studentUpdates, chatThreads, chatMessages, notifications,
}
writeFileSync(new URL('../src/data/seed.json', import.meta.url), JSON.stringify(db) + '\n')
console.log(`Semilla DEMO: ${students.length} alumnos, ${teachers.length} docentes, ${guardians.length} tutores, ${groups.length} grupos, ${charges.length} cargos, ${payments.length} pagos`)
