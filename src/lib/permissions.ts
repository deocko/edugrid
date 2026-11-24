import type { Role } from '../data/types'

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Dirección / Administración',
  docente: 'Docente',
  familia: 'Familia',
  alumno: 'Alumno',
}

export type Access = 'total' | 'grupos' | 'hijos' | 'propio' | 'lectura' | 'ninguno'

export const ACCESS_LABEL: Record<Access, string> = {
  total: 'Todo',
  grupos: 'Solo sus grupos',
  hijos: 'Solo sus hijos',
  propio: 'Solo lo suyo',
  lectura: 'Solo consulta',
  ninguno: 'Sin acceso',
}

export interface MatrixRow {
  area: string
  description: string
  access: Record<Role, Access>
}

/** Matriz de permisos obligatoria. Se aplica en rutas y en cada consulta de datos. */
export const PERMISSION_MATRIX: MatrixRow[] = [
  { area: 'Panel e indicadores', description: 'Resumen de la escuela', access: { admin: 'total', docente: 'grupos', familia: 'hijos', alumno: 'propio' } },
  { area: 'Alumnos y expedientes', description: 'Datos personales de alumnos', access: { admin: 'total', docente: 'grupos', familia: 'hijos', alumno: 'propio' } },
  { area: 'Docentes', description: 'Catálogo de docentes', access: { admin: 'total', docente: 'ninguno', familia: 'ninguno', alumno: 'ninguno' } },
  { area: 'Ciclos, grados, grupos y materias', description: 'Estructura escolar', access: { admin: 'total', docente: 'lectura', familia: 'ninguno', alumno: 'ninguno' } },
  { area: 'Asistencia', description: 'Pase de lista', access: { admin: 'total', docente: 'grupos', familia: 'hijos', alumno: 'propio' } },
  { area: 'Calificaciones', description: 'Captura y consulta', access: { admin: 'total', docente: 'grupos', familia: 'hijos', alumno: 'propio' } },
  { area: 'Tareas y horarios', description: 'Actividades del grupo', access: { admin: 'total', docente: 'grupos', familia: 'hijos', alumno: 'propio' } },
  { area: 'Entradas y salidas (QR)', description: 'Escanear credenciales y ver registros', access: { admin: 'total', docente: 'grupos', familia: 'hijos', alumno: 'propio' } },
  { area: 'Novedades y fotos', description: 'Lo que envían las docentes a las familias', access: { admin: 'total', docente: 'grupos', familia: 'hijos', alumno: 'ninguno' } },
  { area: 'Chat docente-familia', description: 'Conversaciones privadas', access: { admin: 'ninguno', docente: 'grupos', familia: 'hijos', alumno: 'ninguno' } },
  { area: 'Aulas y clases', description: 'Salones, cupo y horario', access: { admin: 'total', docente: 'lectura', familia: 'ninguno', alumno: 'ninguno' } },
  { area: 'Avisos y mensajes', description: 'Comunicación escolar', access: { admin: 'total', docente: 'grupos', familia: 'hijos', alumno: 'propio' } },
  { area: 'Pagos y estados de cuenta', description: 'Cargos, pagos y adeudos', access: { admin: 'total', docente: 'ninguno', familia: 'hijos', alumno: 'ninguno' } },
  { area: 'Facturación (CFDI)', description: 'Emisión y configuración', access: { admin: 'total', docente: 'ninguno', familia: 'ninguno', alumno: 'ninguno' } },
  { area: 'Marca y configuración de la escuela', description: 'Logo, colores y lugares de entrada', access: { admin: 'total', docente: 'lectura', familia: 'lectura', alumno: 'lectura' } },
  { area: 'Bitácora', description: 'Accesos y cambios', access: { admin: 'total', docente: 'ninguno', familia: 'ninguno', alumno: 'ninguno' } },
]

export const HOME_BY_ROLE: Record<Role, string> = {
  admin: '/admin',
  docente: '/docente',
  familia: '/familia',
  alumno: '/alumno',
}
