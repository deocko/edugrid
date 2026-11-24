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
    { to: '/admin/entradas', label: 'Entradas y salidas', short: 'Entradas', icon: 'qr' },
    { to: '/admin/alumnos', label: 'Alumnos', icon: 'alumnos' },
    { to: '/avisos', label: 'Avisos', icon: 'avisos' },
    { to: '/admin/familias', label: 'Familias', icon: 'hijo' },
    { to: '/admin/docentes', label: 'Docentes', icon: 'docente' },
    { to: '/admin/calificaciones', label: 'Calificaciones', icon: 'calificaciones' },
    { to: '/admin/calendario', label: 'Calendario', icon: 'calendario' },
    { to: '/admin/clases', label: 'Clases', icon: 'horario' },
    { to: '/admin/aulas', label: 'Aulas', icon: 'aula' },
    { to: '/admin/escuela', label: 'Ciclos y grupos', icon: 'estructura' },
    { to: '/pagos', label: 'Pagos', icon: 'pagos' },
    { to: '/facturacion', label: 'Facturación', icon: 'factura' },
    { to: '/admin/ajustes', label: 'Configuración', icon: 'ajustes' },
    { to: '/admin/permisos', label: 'Permisos', icon: 'escudo' },
    { to: '/admin/bitacora', label: 'Bitácora', icon: 'bitacora' },
  ],
  docente: [
    { to: '/docente', label: 'Inicio', icon: 'inicio', end: true },
    { to: '/docente/entradas', label: 'Escanear QR', short: 'Escanear', icon: 'qr' },
    { to: '/docente/novedades', label: 'Novedades', icon: 'camara' },
    { to: '/docente/chat', label: 'Chat', icon: 'chat' },
    { to: '/docente/asistencia', label: 'Asistencia', icon: 'asistencia' },
    { to: '/docente/calificaciones', label: 'Calificaciones', short: 'Calificar', icon: 'calificaciones' },
    { to: '/avisos', label: 'Avisos', icon: 'avisos' },
    { to: '/docente/tareas', label: 'Tareas', icon: 'tareas' },
    { to: '/docente/horario', label: 'Horario', icon: 'horario' },
  ],
  familia: [
    { to: '/familia', label: 'Mis hijos', icon: 'hijo', end: true },
    { to: '/familia/qr', label: 'Credencial QR', short: 'QR', icon: 'qr' },
    { to: '/familia/chat', label: 'Chat', icon: 'chat' },
    { to: '/avisos', label: 'Avisos', icon: 'avisos' },
    { to: '/familia/calendario', label: 'Calendario', icon: 'calendario' },
    { to: '/familia/pagos', label: 'Pagos', icon: 'pagos' },
    { to: '/familia/tarjetas', label: 'Mis tarjetas', short: 'Tarjetas', icon: 'tarjeta' },
  ],
  alumno: [
    { to: '/alumno', label: 'Inicio', icon: 'inicio', end: true },
    { to: '/alumno/horario', label: 'Horario', icon: 'horario' },
    { to: '/alumno/tareas', label: 'Tareas', icon: 'tareas' },
    { to: '/alumno/calificaciones', label: 'Calificaciones', short: 'Boleta', icon: 'calificaciones' },
    { to: '/alumno/qr', label: 'Mi credencial QR', short: 'QR', icon: 'qr' },
    { to: '/avisos', label: 'Avisos', icon: 'avisos' },
  ],
}

export interface SettingsItem {
  to: string
  label: string
  icon: IconName
  description: string
}

/**
 * Secciones que la dirección abre desde «Configuración»: en el celular sustituye al botón «Más»
 * y muestra una tarjeta por sección.
 */
export const ADMIN_SETTINGS: SettingsItem[] = [
  { to: '/admin/familias', label: 'Familias', icon: 'hijo', description: 'Tutores, datos fiscales y hermanos' },
  { to: '/admin/docentes', label: 'Docentes', icon: 'docente', description: 'Catálogo, grupos y materias' },
  { to: '/admin/calificaciones', label: 'Calificaciones', icon: 'calificaciones', description: 'Captura y cierre por trimestre' },
  { to: '/admin/calendario', label: 'Calendario', icon: 'calendario', description: 'Eventos, trimestres y tareas' },
  { to: '/admin/clases', label: 'Clases', icon: 'horario', description: 'Horario de cada grupo' },
  { to: '/admin/aulas', label: 'Aulas', icon: 'aula', description: 'Salones, cupo y espacios' },
  { to: '/admin/escuela', label: 'Ciclos y grupos', icon: 'estructura', description: 'Ciclos, grados, grupos y materias' },
  { to: '/pagos', label: 'Pagos', icon: 'pagos', description: 'Cargos, cobros y adeudos' },
  { to: '/facturacion', label: 'Facturación', icon: 'factura', description: 'CFDI de demostración' },
  { to: '/admin/configuracion', label: 'Marca y entradas', icon: 'ajustes', description: 'Logo, colores y lugares de entrada' },
  { to: '/admin/permisos', label: 'Permisos', icon: 'escudo', description: 'Qué ve cada perfil' },
  { to: '/admin/bitacora', label: 'Bitácora', icon: 'bitacora', description: 'Accesos y cambios' },
  { to: '/privacidad', label: 'Privacidad', icon: 'candado', description: 'Aviso de privacidad' },
]

/** ¿La ruta pertenece a Configuración? (para marcar la pestaña activa en el celular) */
export const inSettings = (pathname: string) => pathname === '/admin/ajustes' || ADMIN_SETTINGS.some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`))

/** Módulo de EDUGRID al que pertenece cada vista (se muestra arriba del título). */
const MODULES: [prefix: string, name: string][] = [
  ['/familia/pagos', 'EDUGRID Pay'],
  ['/familia/tarjetas', 'EDUGRID Pay'],
  ['/pagos', 'EDUGRID Pay'],
  ['/facturacion', 'EDUGRID Pay'],
  ['/avisos', 'EDUGRID Connect'],
  ['/notificaciones', 'EDUGRID Connect'],
  ['/docente/chat', 'EDUGRID Connect'],
  ['/familia/chat', 'EDUGRID Connect'],
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
