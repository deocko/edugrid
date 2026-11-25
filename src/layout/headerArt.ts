import type { IconName } from '../components/Icon'
import type { SubjectColor } from '../data/types'

/** Ilustración del encabezado de cada sección: ícono principal y color de acento. */
export interface HeaderArt {
  icon: IconName
  accent: IconName
  color: SubjectColor
}

// La ruta más específica gana (prefijo más largo).
const ART: [prefix: string, art: HeaderArt][] = [
  ['/admin', { icon: 'inicio', accent: 'escudo', color: 'azul' }],
  ['/admin/alumnos', { icon: 'alumnos', accent: 'libro', color: 'azul' }],
  ['/alumnos', { icon: 'alumnos', accent: 'libro', color: 'azul' }],
  ['/admin/familias', { icon: 'hijo', accent: 'bebe', color: 'rosa' }],
  ['/admin/docentes', { icon: 'docente', accent: 'libro', color: 'indigo' }],
  ['/admin/aulas', { icon: 'aula', accent: 'alumnos', color: 'verde' }],
  ['/admin/clases', { icon: 'horario', accent: 'libro', color: 'turquesa' }],
  ['/admin/escuela', { icon: 'estructura', accent: 'docente', color: 'indigo' }],
  ['/admin/lugares-qr', { icon: 'qr', accent: 'aula', color: 'verde' }],
  ['/admin/configuracion', { icon: 'ajustes', accent: 'escudo', color: 'morado' }],
  ['/admin/ajustes', { icon: 'ajustes', accent: 'estructura', color: 'morado' }],
  ['/admin/permisos', { icon: 'escudo', accent: 'candado', color: 'gris' }],
  ['/admin/bitacora', { icon: 'bitacora', accent: 'ojo', color: 'gris' }],
  ['/admin/entradas', { icon: 'qr', accent: 'check', color: 'turquesa' }],
  ['/admin/calificaciones', { icon: 'calificaciones', accent: 'docente', color: 'morado' }],
  ['/admin/calendario', { icon: 'calendario', accent: 'horario', color: 'naranja' }],
  ['/docente', { icon: 'docente', accent: 'libro', color: 'verde' }],
  ['/docente/asistencia', { icon: 'asistencia', accent: 'check', color: 'verde' }],
  ['/docente/calificaciones', { icon: 'calificaciones', accent: 'docente', color: 'morado' }],
  ['/docente/tareas', { icon: 'tareas', accent: 'libro', color: 'rosa' }],
  ['/docente/horario', { icon: 'horario', accent: 'calendario', color: 'turquesa' }],
  ['/docente/entradas', { icon: 'qr', accent: 'check', color: 'turquesa' }],
  ['/docente/novedades', { icon: 'camara', accent: 'hijo', color: 'naranja' }],
  ['/docente/chat', { icon: 'chat', accent: 'mensajes', color: 'azul' }],
  ['/familia', { icon: 'hijo', accent: 'bebe', color: 'rosa' }],
  ['/familia/hijo', { icon: 'libro', accent: 'docente', color: 'rosa' }],
  ['/familia/calendario', { icon: 'calendario', accent: 'horario', color: 'naranja' }],
  ['/familia/pagos', { icon: 'pagos', accent: 'tarjeta', color: 'ambar' }],
  ['/familia/tarjetas', { icon: 'tarjeta', accent: 'candado', color: 'morado' }],
  ['/familia/qr', { icon: 'qr', accent: 'check', color: 'turquesa' }],
  ['/familia/chat', { icon: 'chat', accent: 'mensajes', color: 'azul' }],
  ['/alumno', { icon: 'libro', accent: 'docente', color: 'azul' }],
  ['/alumno/horario', { icon: 'horario', accent: 'calendario', color: 'turquesa' }],
  ['/alumno/tareas', { icon: 'tareas', accent: 'libro', color: 'rosa' }],
  ['/alumno/calificaciones', { icon: 'calificaciones', accent: 'docente', color: 'morado' }],
  ['/alumno/qr', { icon: 'qr', accent: 'check', color: 'turquesa' }],
  ['/avisos', { icon: 'avisos', accent: 'campana', color: 'naranja' }],
  ['/notificaciones', { icon: 'campana', accent: 'avisos', color: 'ambar' }],
  ['/pagos', { icon: 'pagos', accent: 'factura', color: 'ambar' }],
  ['/facturacion', { icon: 'factura', accent: 'pagos', color: 'rojo' }],
  ['/privacidad', { icon: 'candado', accent: 'escudo', color: 'gris' }],
  ['/perfil', { icon: 'persona', accent: 'camara', color: 'indigo' }],
  ['/mas', { icon: 'menu', accent: 'ajustes', color: 'azul' }],
]

export function artFor(pathname: string): HeaderArt {
  let best: HeaderArt = { icon: 'inicio', accent: 'libro', color: 'azul' }
  let len = -1
  for (const [p, art] of ART) {
    const hit = pathname === p || pathname.startsWith(`${p}/`)
    if (hit && p.length > len) {
      best = art
      len = p.length
    }
  }
  return best
}
