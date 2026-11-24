import type { IconName } from '../components/Icon'
import type { Role } from '../data/types'

export interface NavItem {
  to: string
  label: string
  icon: IconName
  end?: boolean
  /** Etiqueta corta para la barra inferior en celular. */
  short?: string
}

export const NAV: Record<Role, NavItem[]> = {
  admin: [
    { to: '/admin', label: 'Inicio', icon: 'inicio', end: true },
    { to: '/admin/alumnos', label: 'Alumnos', icon: 'alumnos' },
    { to: '/pagos', label: 'Pagos', icon: 'pagos' },
    { to: '/avisos', label: 'Avisos', icon: 'avisos' },
    { to: '/admin/docentes', label: 'Docentes', icon: 'docente' },
    { to: '/admin/escuela', label: 'Ciclos y grupos', icon: 'estructura' },
    { to: '/facturacion', label: 'Facturación', icon: 'factura' },
    { to: '/admin/permisos', label: 'Permisos', icon: 'escudo' },
    { to: '/admin/bitacora', label: 'Bitácora', icon: 'bitacora' },
  ],
  docente: [
    { to: '/docente', label: 'Inicio', icon: 'inicio', end: true },
    { to: '/docente/asistencia', label: 'Asistencia', icon: 'asistencia' },
    { to: '/docente/calificaciones', label: 'Calificaciones', short: 'Calificar', icon: 'calificaciones' },
    { to: '/avisos', label: 'Mensajes', icon: 'mensajes' },
    { to: '/docente/tareas', label: 'Tareas', icon: 'tareas' },
    { to: '/docente/horario', label: 'Horario', icon: 'horario' },
  ],
  familia: [
    { to: '/familia', label: 'Mis hijos', icon: 'hijo', end: true },
    { to: '/familia/pagos', label: 'Pagos', icon: 'pagos' },
    { to: '/avisos', label: 'Avisos', icon: 'avisos' },
    { to: '/familia/calendario', label: 'Calendario', icon: 'calendario' },
  ],
  alumno: [
    { to: '/alumno', label: 'Inicio', icon: 'inicio', end: true },
    { to: '/alumno/horario', label: 'Horario', icon: 'horario' },
    { to: '/alumno/tareas', label: 'Tareas', icon: 'tareas' },
    { to: '/alumno/calificaciones', label: 'Calificaciones', short: 'Boleta', icon: 'calificaciones' },
    { to: '/avisos', label: 'Avisos', icon: 'avisos' },
  ],
}

/** Módulo de EDUGRID al que pertenece cada vista (se muestra arriba del título). */
const MODULES: [prefix: string, name: string][] = [
  ['/familia/pagos', 'EDUGRID Pay'],
  ['/pagos', 'EDUGRID Pay'],
  ['/facturacion', 'EDUGRID Pay'],
  ['/avisos', 'EDUGRID Connect'],
  ['/admin', 'EDUGRID Admin'],
  ['/alumnos/', 'EDUGRID Admin'],
  ['/docente', 'EDUGRID Academy'],
  ['/familia', 'EDUGRID Family'],
  ['/alumno', 'EDUGRID Student'],
]

export function moduleForPath(pathname: string): string | null {
  const hit = MODULES.find(([p]) => pathname === p || pathname.startsWith(p.endsWith('/') ? p : `${p}/`))
  return hit ? hit[1] : null
}
