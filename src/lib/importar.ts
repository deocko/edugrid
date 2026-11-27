import type { EdugridRepository } from '../data/repository'
import type { PersonaInvitada } from '../data/cuentaTipos'
import { GRADOS_POR_NIVEL } from '../data/escuelaNueva'
import type { Database, Group, Guardian, Level, SchoolGrade, Student, Teacher } from '../data/types'
import { nowISO, uid } from './format'
import { EMAIL_RE } from './profile'
import { newQrCode } from './qr'
import { isPreschool, LEVEL_LABEL, schoolLevels } from './scope'

/**
 * Importar desde Excel: alumnos, docentes y familias. Las columnas se definen UNA
 * sola vez aquí y las usan tanto la plantilla que se descarga como el importador.
 */
export type TipoImportacion = 'alumnos' | 'docentes' | 'familias'

export interface Columna {
  clave: string
  titulo: string
  obligatoria: boolean
  ayuda: string
  /** Valores de las 2 filas de ejemplo de la plantilla. */
  ejemplo: [string, string]
}

const PARENTESCOS: Guardian['relation'][] = ['Madre', 'Padre', 'Tutor', 'Tutora']
const NIVELES: Level[] = ['maternal', 'kinder', 'primaria', 'secundaria', 'preparatoria']

export const COLUMNAS: Record<TipoImportacion, Columna[]> = {
  alumnos: [
    { clave: 'nombre', titulo: 'Nombre(s)', obligatoria: true, ayuda: 'Nombre o nombres del alumno.', ejemplo: ['EJEMPLO Sofía', 'EJEMPLO Diego'] },
    { clave: 'apellidos', titulo: 'Apellidos', obligatoria: true, ayuda: 'Apellido paterno y materno.', ejemplo: ['Ramírez López (DEMO)', 'Ramírez López (DEMO)'] },
    { clave: 'fechaNacimiento', titulo: 'Fecha de nacimiento', obligatoria: true, ayuda: 'AAAA-MM-DD o DD/MM/AAAA.', ejemplo: ['2017-03-14', '2019-09-02'] },
    { clave: 'nivel', titulo: 'Nivel', obligatoria: true, ayuda: 'Maternal, Kinder, Primaria, Secundaria o Preparatoria.', ejemplo: ['Primaria', 'Primaria'] },
    { clave: 'grado', titulo: 'Grado', obligatoria: true, ayuda: 'Número del grado: 1 a 6 en primaria, 1 a 3 en kinder, secundaria y preparatoria, 1 en maternal.', ejemplo: ['3', '1'] },
    { clave: 'grupo', titulo: 'Grupo', obligatoria: true, ayuda: 'Letra del grupo, por ejemplo A. Si no existe, se crea.', ejemplo: ['A', 'B'] },
    { clave: 'curp', titulo: 'CURP', obligatoria: false, ayuda: '18 caracteres. Se puede capturar después.', ejemplo: ['', ''] },
    { clave: 'correo', titulo: 'Correo del alumno', obligatoria: false, ayuda: 'Si el alumno tiene correo propio, ahí le llega su invitación. Si no, le llega a su tutor.', ejemplo: ['', ''] },
    { clave: 'tutorNombre', titulo: 'Nombre del tutor', obligatoria: false, ayuda: 'Madre, padre o tutor. Hermanos con el mismo correo de tutor quedan con la misma familia.', ejemplo: ['EJEMPLO Laura', 'EJEMPLO Laura'] },
    { clave: 'tutorApellidos', titulo: 'Apellidos del tutor', obligatoria: false, ayuda: 'Obligatorio si escribiste el nombre del tutor.', ejemplo: ['López Ortega (DEMO)', 'López Ortega (DEMO)'] },
    { clave: 'tutorParentesco', titulo: 'Parentesco', obligatoria: false, ayuda: 'Madre, Padre, Tutor o Tutora. Si se deja vacío: Tutor.', ejemplo: ['Madre', 'Madre'] },
    { clave: 'tutorCorreo', titulo: 'Correo del tutor', obligatoria: false, ayuda: 'Ahí le llega la invitación a la familia.', ejemplo: ['laura.ejemplo@demo.edugrid.mx', 'laura.ejemplo@demo.edugrid.mx'] },
    { clave: 'tutorTelefono', titulo: 'Teléfono del tutor', obligatoria: false, ayuda: '10 dígitos.', ejemplo: ['5500000000', '5500000000'] },
  ],
  docentes: [
    { clave: 'nombre', titulo: 'Nombre(s)', obligatoria: true, ayuda: 'Nombre o nombres.', ejemplo: ['EJEMPLO Carmen', 'EJEMPLO Jorge'] },
    { clave: 'apellidos', titulo: 'Apellidos', obligatoria: true, ayuda: 'Apellido paterno y materno.', ejemplo: ['Salinas Ruiz (DEMO)', 'Medina Paz (DEMO)'] },
    { clave: 'especialidad', titulo: 'Especialidad', obligatoria: true, ayuda: 'Por ejemplo: Titular de primaria, Inglés, Educación Física.', ejemplo: ['Titular de primaria', 'Inglés'] },
    { clave: 'correo', titulo: 'Correo', obligatoria: false, ayuda: 'Ahí le llega su invitación para crear su contraseña.', ejemplo: ['carmen.ejemplo@demo.edugrid.mx', 'jorge.ejemplo@demo.edugrid.mx'] },
    { clave: 'telefono', titulo: 'Teléfono', obligatoria: false, ayuda: '10 dígitos.', ejemplo: ['5500000001', '5500000002'] },
  ],
  familias: [
    { clave: 'nombre', titulo: 'Nombre(s)', obligatoria: true, ayuda: 'Nombre de la madre, padre o tutor.', ejemplo: ['EJEMPLO Laura', 'EJEMPLO Ricardo'] },
    { clave: 'apellidos', titulo: 'Apellidos', obligatoria: true, ayuda: 'Apellido paterno y materno.', ejemplo: ['López Ortega (DEMO)', 'Ramírez Soto (DEMO)'] },
    { clave: 'parentesco', titulo: 'Parentesco', obligatoria: true, ayuda: 'Madre, Padre, Tutor o Tutora.', ejemplo: ['Madre', 'Padre'] },
    { clave: 'correo', titulo: 'Correo', obligatoria: false, ayuda: 'Ahí le llega su invitación.', ejemplo: ['laura.ejemplo@demo.edugrid.mx', 'ricardo.ejemplo@demo.edugrid.mx'] },
    { clave: 'telefono', titulo: 'Teléfono', obligatoria: false, ayuda: '10 dígitos.', ejemplo: ['5500000003', '5500000004'] },
  ],
}

export const NOMBRE_TIPO: Record<TipoImportacion, { plural: string; singular: string }> = {
  alumnos: { plural: 'alumnos', singular: 'alumno' },
  docentes: { plural: 'docentes', singular: 'docente' },
  familias: { plural: 'familias', singular: 'familia' },
}

const titulo = (c: Columna) => (c.obligatoria ? `${c.titulo} *` : c.titulo)
const normal = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
/** Las filas de ejemplo de la plantilla empiezan con EJEMPLO y no se importan. */
export const esEjemplo = (fila: Record<string, string>) => /^ejemplo\b/i.test((fila.nombre ?? '').trim())

const cargarXlsx = () => import('xlsx')

/** Plantilla .xlsx: columnas exactas, 2 filas de ejemplo y una hoja con instrucciones. */
export async function plantilla(tipo: TipoImportacion): Promise<Blob> {
  const XLSX = await cargarXlsx()
  const cols = COLUMNAS[tipo]
  const hoja = XLSX.utils.aoa_to_sheet([cols.map(titulo), cols.map((c) => c.ejemplo[0]), cols.map((c) => c.ejemplo[1])])
  hoja['!cols'] = cols.map((c) => ({ wch: Math.max(14, titulo(c).length + 4) }))
  const instrucciones = XLSX.utils.aoa_to_sheet([
    [`Plantilla de ${NOMBRE_TIPO[tipo].plural} para EDUGRID`],
    [''],
    ['Las columnas con * son obligatorias. No cambies los títulos de la primera fila.'],
    ['Las 2 filas que empiezan con EJEMPLO son de muestra (datos DEMO): no se importan, puedes borrarlas.'],
    ['Cada persona con correo recibe una invitación para crear su contraseña. Sin correo, se registra sin cuenta y la invitas después.'],
    [''],
    ['Columna', '¿Obligatoria?', 'Qué escribir'],
    ...cols.map((c) => [c.titulo, c.obligatoria ? 'Sí' : 'No', c.ayuda]),
  ])
  instrucciones['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 90 }]
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, NOMBRE_TIPO[tipo].plural[0]!.toUpperCase() + NOMBRE_TIPO[tipo].plural.slice(1))
  XLSX.utils.book_append_sheet(libro, instrucciones, 'Instrucciones')
  const datos = XLSX.write(libro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new Blob([datos], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

const p2 = (n: number) => String(n).padStart(2, '0')
const celda = (v: unknown): string => {
  if (v instanceof Date) return `${v.getFullYear()}-${p2(v.getMonth() + 1)}-${p2(v.getDate())}`
  return v === null || v === undefined ? '' : String(v).trim()
}

export interface Lectura {
  filas: { numero: number; datos: Record<string, string> }[]
  /** Problemas de todo el archivo (por ejemplo, falta una columna obligatoria). */
  errores: string[]
}

/** Lee la primera hoja del Excel (o CSV) y la convierte a filas con las claves de COLUMNAS. */
export async function leerExcel(tipo: TipoImportacion, archivo: File | ArrayBuffer): Promise<Lectura> {
  const XLSX = await cargarXlsx()
  const buf = archivo instanceof ArrayBuffer ? archivo : await archivo.arrayBuffer()
  if (buf.byteLength > 5 * 1024 * 1024) return { filas: [], errores: ['El archivo pesa más de 5 MB. Divide la lista en varios archivos.'] }
  let libro
  try {
    libro = XLSX.read(buf, { type: 'array', cellDates: true })
  } catch {
    return { filas: [], errores: ['No se pudo leer el archivo. Usa la plantilla en formato Excel (.xlsx).'] }
  }
  const hoja = libro.Sheets[libro.SheetNames[0] ?? '']
  if (!hoja) return { filas: [], errores: ['El archivo no tiene hojas.'] }
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw: true, defval: '', blankrows: false })
  const encabezados = (matriz[0] ?? []).map((h) => normal(celda(h)))
  const cols = COLUMNAS[tipo]
  const indice = new Map<string, number>()
  for (const c of cols) {
    const i = encabezados.indexOf(normal(c.titulo))
    if (i >= 0) indice.set(c.clave, i)
  }
  const faltan = cols.filter((c) => c.obligatoria && !indice.has(c.clave)).map((c) => `«${c.titulo}»`)
  if (faltan.length) return { filas: [], errores: [`Faltan columnas obligatorias: ${faltan.join(', ')}. Descarga la plantilla y copia ahí tus datos.`] }
  const filas: Lectura['filas'] = []
  matriz.slice(1).forEach((r, k) => {
    const datos: Record<string, string> = {}
    for (const c of cols) datos[c.clave] = celda(indice.has(c.clave) ? r[indice.get(c.clave)!] : '')
    if (Object.values(datos).some((v) => v !== '')) filas.push({ numero: k + 2, datos })
  })
  if (filas.length > 2000) return { filas: [], errores: ['El archivo tiene más de 2,000 filas. Divide la lista en varios archivos.'] }
  return { filas, errores: [] }
}

export interface FilaRevisada {
  /** Número de fila en el Excel (la 1 son los títulos). */
  numero: number
  datos: Record<string, string>
  nombre: string
  ejemplo: boolean
  errores: string[]
  /** Aviso que no impide importar (por ejemplo, «sin correo: invítalo después»). */
  aviso?: string
  /** Alumnos: grupo que la importación va a crear porque no existe (por ejemplo «2° de primaria B»). */
  grupoNuevo?: string
  /** Familias: id de la familia que ya tiene este correo (se reutiliza en lugar de duplicarla). */
  familiaExistente?: string
}

const fechaISO = (t: string): string | null => {
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t)
  let y: number, mo: number, d: number
  if (m) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  else {
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t)
    if (!m) return null
    ;[d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
    if (y < 100) y += y > 50 ? 1900 : 2000
  }
  const f = new Date(y, mo - 1, d)
  if (f.getFullYear() !== y || f.getMonth() !== mo - 1 || f.getDate() !== d || y < 1950) return null
  return `${y}-${p2(mo)}-${p2(d)}`
}
const CURP_RE = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/
const nivelDe = (t: string): Level | null => NIVELES.find((n) => normal(n) === normal(t) || (n === 'preparatoria' && ['prepa', 'bachillerato'].includes(normal(t)))) ?? null
const parentescoDe = (t: string): Guardian['relation'] | null => PARENTESCOS.find((p) => normal(p) === normal(t)) ?? null
const correoDe = (t: string) => t.trim().toLowerCase()

/**
 * Revisa cada fila ANTES de importar: obligatorios, formato de correo, fechas,
 * y correos repetidos (dentro del archivo y contra lo que ya tiene la escuela).
 */
export function revisar(db: Database, tipo: TipoImportacion, lectura: Lectura): FilaRevisada[] {
  const cols = COLUMNAS[tipo]
  // Familias: un correo que ya es de una familia (por ejemplo, la creó la importación de alumnos)
  // no es un error: se reutiliza esa familia y su misma invitación.
  const existentes = new Set(
    (tipo === 'alumnos' ? db.students.map((s) => s.email ?? '') : tipo === 'docentes' ? db.teachers.map((t) => t.email) : [])
      .map(correoDe)
      .filter(Boolean),
  )
  const familiaPorCorreo = new Map(db.guardians.filter((g) => g.email).map((g) => [correoDe(g.email), g]))
  const niveles = schoolLevels(db)
  const ciclo = db.cycles.find((c) => c.active) ?? db.cycles[0]
  const enArchivo = new Map<string, number>()
  return lectura.filas.map(({ numero, datos }) => {
    const nombre = `${datos.nombre ?? ''} ${datos.apellidos ?? ''}`.trim()
    const fila: FilaRevisada = { numero, datos, nombre, ejemplo: esEjemplo(datos), errores: [] }
    if (fila.ejemplo) return fila
    const e = fila.errores
    for (const c of cols) if (c.obligatoria && !datos[c.clave]) e.push(`Falta «${c.titulo}».`)
    const correo = correoDe(datos.correo ?? '')
    if (correo) {
      if (!EMAIL_RE.test(correo)) e.push(`El correo «${datos.correo}» no tiene un formato válido.`)
      else if (existentes.has(correo)) e.push(`El correo ${correo} ya está registrado en la escuela.`)
      else if (enArchivo.has(correo)) e.push(`El correo ${correo} se repite (ya está en la fila ${enArchivo.get(correo)}).`)
      else enArchivo.set(correo, numero)
    }
    if (tipo === 'alumnos') {
      if (datos.fechaNacimiento && !fechaISO(datos.fechaNacimiento)) e.push('La fecha de nacimiento no es válida (usa AAAA-MM-DD o DD/MM/AAAA).')
      const nivel = datos.nivel ? nivelDe(datos.nivel) : null
      if (datos.nivel && !nivel) e.push(`El nivel «${datos.nivel}» no existe (Maternal, Kinder, Primaria, Secundaria o Preparatoria).`)
      else if (nivel && !niveles.includes(nivel)) e.push(`La escuela no tiene el nivel ${LEVEL_LABEL[nivel]} (atiende: ${niveles.map((l) => LEVEL_LABEL[l]).join(', ') || 'ninguno'}).`)
      const grado = Number(datos.grado)
      if (nivel && datos.grado && (!Number.isInteger(grado) || grado < 1 || grado > GRADOS_POR_NIVEL[nivel].length))
        e.push(`El grado «${datos.grado}» no existe en ${nivel} (de 1 a ${GRADOS_POR_NIVEL[nivel].length}).`)
      if (datos.grupo && !/^[A-Za-z0-9]{1,3}$/.test(datos.grupo)) e.push('El grupo debe ser una letra o número corto, por ejemplo A.')
      else if (nivel && datos.grupo && Number.isInteger(grado) && grado >= 1 && grado <= GRADOS_POR_NIVEL[nivel].length) {
        const letra = datos.grupo.toUpperCase()
        const gradoDb = db.grades.find((g) => g.level === nivel && g.order === grado)
        const existe = !!gradoDb && db.groups.some((g) => g.gradeId === gradoDb.id && g.name.toUpperCase() === letra && (!ciclo || g.cycleId === ciclo.id))
        if (!existe) fila.grupoNuevo = `${gradoDb?.name ?? GRADOS_POR_NIVEL[nivel][grado - 1]} ${letra}`
      }
      if (datos.curp && !CURP_RE.test(datos.curp.toUpperCase())) e.push('La CURP no tiene el formato correcto (18 caracteres).')
      const conTutor = !!(datos.tutorNombre || datos.tutorApellidos || datos.tutorCorreo)
      if (conTutor && (!datos.tutorNombre || !datos.tutorApellidos)) e.push('Escribe nombre y apellidos del tutor.')
      if (datos.tutorParentesco && !parentescoDe(datos.tutorParentesco)) e.push('El parentesco debe ser Madre, Padre, Tutor o Tutora.')
      const tc = correoDe(datos.tutorCorreo ?? '')
      if (tc && !EMAIL_RE.test(tc)) e.push(`El correo del tutor «${datos.tutorCorreo}» no tiene un formato válido.`)
      const avisos = [fila.grupoNuevo ? `Se creará el grupo ${fila.grupoNuevo}.` : '', !correo && !tc ? 'Sin correo: invítalo después.' : ''].filter(Boolean)
      if (avisos.length) fila.aviso = avisos.join(' ')
    } else {
      if (tipo === 'familias' && datos.parentesco && !parentescoDe(datos.parentesco)) e.push('El parentesco debe ser Madre, Padre, Tutor o Tutora.')
      if (tipo === 'familias' && correo && familiaPorCorreo.has(correo) && !e.length) {
        const g = familiaPorCorreo.get(correo)!
        fila.familiaExistente = g.id
        fila.aviso = `Ya existe la familia de ${g.firstName} ${g.lastName} con este correo: se reutiliza (no se duplica) y conserva su misma invitación.`
      }
      if (!correo) fila.aviso = 'Sin correo: invítalo después.'
    }
    return fila
  })
}

export interface PlanImportacion {
  /** Escribe todo en el repositorio (un solo lote en la base en línea). */
  aplicar: (repo: EdugridRepository) => Promise<void>
  importadas: number
  /** Familias que ya existían con ese correo y se reutilizaron (no se duplicaron). */
  reutilizadas?: number
  /** Personas a invitar por correo (vacío en la demo). */
  invitaciones: PersonaInvitada[]
  /** Filas que se importaron sin correo (sin cuenta). */
  sinCorreo: FilaRevisada[]
}

/**
 * Convierte las filas válidas en registros. Los grupos que falten se crean en el
 * ciclo activo, pero la vista previa lo avisa antes (FilaRevisada.grupoNuevo). Hermanos con el mismo correo de tutor comparten una sola familia
 * (y por eso una sola cuenta).
 */
export function planear(db: Database, tipo: TipoImportacion, filas: FilaRevisada[], o: { demo: boolean }): PlanImportacion {
  const validas = filas.filter((f) => !f.ejemplo && f.errores.length === 0)
  const ahora = nowISO()
  const invitaciones: PersonaInvitada[] = []
  const sinCorreo = validas.filter((f) => f.aviso)
  if (tipo === 'docentes') {
    const nuevos: Teacher[] = validas.map((f) => ({ id: uid('t'), firstName: f.datos.nombre!, lastName: f.datos.apellidos!, specialty: f.datos.especialidad!, email: correoDe(f.datos.correo ?? ''), phone: f.datos.telefono ?? '', active: true }))
    for (const t of nuevos) if (t.email) invitaciones.push({ tipo: 'docente', referencia: t.id, correo: t.email, nombre: `${t.firstName} ${t.lastName}` })
    return { aplicar: (r) => (nuevos.length ? r.insert('teachers', nuevos) : Promise.resolve()), importadas: nuevos.length, invitaciones: o.demo ? [] : invitaciones, sinCorreo }
  }
  const tutorNuevo = (nombre: string, apellidos: string, relacion: Guardian['relation'], correo: string, telefono: string): Guardian => ({
    id: uid('tu'), firstName: nombre, lastName: apellidos, relation: relacion, email: correo, phone: telefono,
    rfc: 'XAXX010101000', taxName: 'PUBLICO EN GENERAL', taxZip: db.meta.cfdiConfig.codigoPostal, taxRegime: '616', consentAt: ahora,
  })
  if (tipo === 'familias') {
    const nuevos = validas.filter((f) => !f.familiaExistente).map((f) => tutorNuevo(f.datos.nombre!, f.datos.apellidos!, parentescoDe(f.datos.parentesco!) ?? 'Tutor', correoDe(f.datos.correo ?? ''), f.datos.telefono ?? ''))
    for (const g of nuevos) if (g.email) invitaciones.push({ tipo: 'familia', referencia: g.id, correo: g.email, nombre: `${g.firstName} ${g.lastName}` })
    // La familia que ya existía conserva su invitación (la API la reutiliza; no crea otra).
    const reutilizadas = validas.filter((f) => f.familiaExistente).map((f) => db.guardians.find((g) => g.id === f.familiaExistente)!)
    for (const g of reutilizadas) invitaciones.push({ tipo: 'familia', referencia: g.id, correo: correoDe(g.email), nombre: `${g.firstName} ${g.lastName}` })
    return { aplicar: (r) => (nuevos.length ? r.insert('guardians', nuevos) : Promise.resolve()), importadas: nuevos.length, reutilizadas: reutilizadas.length, invitaciones: o.demo ? [] : invitaciones, sinCorreo }
  }

  // Alumnos
  const ciclo = db.cycles.find((c) => c.active) ?? db.cycles[0]
  const grados: SchoolGrade[] = []
  const grupos: Group[] = []
  const tutores: Guardian[] = []
  const alumnos: Student[] = []
  const tutoresPorCorreo = new Map<string, Guardian>(db.guardians.filter((g) => g.email).map((g) => [correoDe(g.email), g]))
  const invitadosFamilia = new Set<string>()
  const qrs = db.students.map((s) => s.qrCode)
  let seq = db.students.length
  for (const f of validas) {
    const nivel = nivelDe(f.datos.nivel!)!
    const orden = Number(f.datos.grado)
    let grado: SchoolGrade | undefined = [...db.grades, ...grados].find((g) => g.level === nivel && g.order === orden)
    if (!grado) {
      grado = { id: `g-${nivel}-${orden}`, level: nivel, name: GRADOS_POR_NIVEL[nivel][orden - 1]!, order: orden }
      grados.push(grado)
    }
    const letra = f.datos.grupo!.toUpperCase()
    let grupo = [...db.groups, ...grupos].find((g) => g.gradeId === grado!.id && g.name.toUpperCase() === letra && (!ciclo || g.cycleId === ciclo.id))
    if (!grupo) {
      grupo = { id: `gr-${nivel}-${orden}${letra}-${uid('x').slice(2, 6)}`, gradeId: grado.id, cycleId: ciclo?.id ?? '', name: letra, homeroomTeacherId: '', room: '' }
      grupos.push(grupo)
    }
    let tutor: Guardian | undefined
    const tc = correoDe(f.datos.tutorCorreo ?? '')
    if (f.datos.tutorNombre) {
      tutor = tc ? tutoresPorCorreo.get(tc) : undefined
      if (!tutor) {
        tutor = tutorNuevo(f.datos.tutorNombre, f.datos.tutorApellidos!, parentescoDe(f.datos.tutorParentesco ?? '') ?? 'Tutor', tc, f.datos.tutorTelefono ?? '')
        tutores.push(tutor)
        if (tc) tutoresPorCorreo.set(tc, tutor)
      }
      if (tc && !invitadosFamilia.has(tutor.id)) {
        invitadosFamilia.add(tutor.id)
        invitaciones.push({ tipo: 'familia', referencia: tutor.id, correo: tc, nombre: `${tutor.firstName} ${tutor.lastName}` })
      }
    }
    const qr = newQrCode(qrs)
    qrs.push(qr)
    seq++
    const correo = correoDe(f.datos.correo ?? '')
    const alumno: Student = {
      id: uid('al'), firstName: f.datos.nombre!, lastName: f.datos.apellidos!, birthDate: fechaISO(f.datos.fechaNacimiento ?? '') ?? '', curp: f.datos.curp ? f.datos.curp.toUpperCase() : 'PENDIENTE',
      groupId: grupo.id, guardianIds: tutor ? [tutor.id] : [], enrollmentId: `${o.demo ? 'DEMO' : 'MAT'}-${String(seq).padStart(4, '0')}`, status: 'activo', createdAt: ahora, qrCode: qr,
      ...(correo ? { email: correo } : {}),
    }
    alumnos.push(alumno)
    // El alumno recibe su invitación en su correo; si no tiene, en el de su tutor (maternal y kinder no tienen portal de alumno).
    const destino = correo || tc
    if (destino && !isPreschool(nivel)) invitaciones.push({ tipo: 'alumno', referencia: alumno.id, correo: destino, nombre: `${alumno.firstName} ${alumno.lastName}` })
  }
  return {
    aplicar: async (r) => {
      if (grados.length) await r.insert('grades', grados)
      if (grupos.length) await r.insert('groups', grupos)
      if (tutores.length) await r.insert('guardians', tutores)
      if (alumnos.length) await r.insert('students', alumnos)
    },
    importadas: alumnos.length,
    invitaciones: o.demo ? [] : invitaciones,
    sinCorreo,
  }
}
