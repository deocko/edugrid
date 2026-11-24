import type { IconName } from '../components/Icon'
import type { Role, SubjectColor } from '../data/types'

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
  /** Tono pastel de la tarjeta (usa la misma paleta accesible de las materias). */
  color: SubjectColor
}

/**
 * Secciones que la dirección abre desde «Configuración»: en el celular sustituye al botón «Más»
 * y muestra una tarjeta por sección.
 */
export const ADMIN_SETTINGS: SettingsItem[] = [
  { to: '/admin/familias', label: 'Familias', icon: 'hijo', description: 'Tutores, datos fiscales y hermanos', color: 'rosa' },
  { to: '/admin/docentes', label: 'Docentes', icon: 'docente', description: 'Catálogo, grupos y materias', color: 'azul' },
  { to: '/admin/calificaciones', label: 'Calificaciones', icon: 'calificaciones', description: 'Captura y cierre por trimestre', color: 'morado' },
  { to: '/admin/calendario', label: 'Calendario', icon: 'calendario', description: 'Eventos, trimestres y tareas', color: 'naranja' },
  { to: '/admin/clases', label: 'Clases', icon: 'horario', description: 'Horario de cada grupo', color: 'turquesa' },
  { to: '/admin/aulas', label: 'Aulas', icon: 'aula', description: 'Salones, cupo y espacios', color: 'verde' },
  { to: '/admin/escuela', label: 'Ciclos y grupos', icon: 'estructura', description: 'Ciclos, grados, grupos y materias', color: 'indigo' },
  { to: '/pagos', label: 'Pagos', icon: 'pagos', description: 'Cargos, cobros y adeudos', color: 'ambar' },
  { to: '/facturacion', label: 'Facturación', icon: 'factura', description: 'CFDI de demostración', color: 'rojo' },
  { to: '/admin/configuracion', label: 'Marca y entradas', icon: 'ajustes', description: 'Logo, colores y lugares de entrada', color: 'azul' },
  { to: '/admin/permisos', label: 'Permisos', icon: 'escudo', description: 'Qué ve cada perfil', color: 'morado' },
  { to: '/admin/bitacora', label: 'Bitácora', icon: 'bitacora', description: 'Accesos y cambios', color: 'gris' },
  { to: '/privacidad', label: 'Privacidad', icon: 'candado', description: 'Aviso de privacidad', color: 'turquesa' },
]

/** Lo que no cabe en la barra inferior del celular, en tarjetas: docente, familia y alumno. */
export const MORE_ITEMS: Record<Exclude<Role, 'admin'>, SettingsItem[]> = {
  docente: [
    { to: '/docente/asistencia', label: 'Asistencia', icon: 'asistencia', description: 'Pase de lista del día', color: 'verde' },
    { to: '/docente/calificaciones', label: 'Calificaciones', icon: 'calificaciones', description: 'Captura por materia y trimestre', color: 'morado' },
    { to: '/avisos', label: 'Avisos', icon: 'avisos', description: 'Mensajes a tus grupos', color: 'naranja' },
    { to: '/docente/tareas', label: 'Tareas', icon: 'tareas', description: 'Deja y revisa tareas', color: 'rosa' },
    { to: '/docente/horario', label: 'Horario', icon: 'horario', description: 'Tus clases de la semana', color: 'turquesa' },
    { to: '/privacidad', label: 'Privacidad', icon: 'candado', description: 'Aviso de privacidad', color: 'gris' },
  ],
  familia: [
    { to: '/familia/calendario', label: 'Calendario', icon: 'calendario', description: 'Eventos, tareas y entradas', color: 'naranja' },
    { to: '/familia/pagos', label: 'Pagos', icon: 'pagos', description: 'Colegiaturas y estado de cuenta', color: 'ambar' },
    { to: '/familia/tarjetas', label: 'Mis tarjetas', icon: 'tarjeta', description: 'Tarjetas para pagar en la app', color: 'morado' },
    { to: '/privacidad', label: 'Privacidad', icon: 'candado', description: 'Aviso de privacidad', color: 'turquesa' },
  ],
  alumno: [
    { to: '/alumno/qr', label: 'Mi credencial', icon: 'qr', description: 'Tu código QR para entrar', color: 'azul' },
    { to: '/avisos', label: 'Avisos', icon: 'avisos', description: 'Lo que manda tu escuela', color: 'naranja' },
    { to: '/privacidad', label: 'Privacidad', icon: 'candado', description: 'Aviso de privacidad', color: 'turquesa' },
  ],
}

/** Pantalla de tarjetas de cada perfil: «Configuración» para dirección y «Más» para los demás. */
export const hubFor = (role: Role) =>
  role === 'admin'
    ? { to: '/admin/ajustes', label: 'Configuración', title: 'Configuración', subtitle: 'Todo lo que administra la dirección, en un solo lugar.', items: ADMIN_SETTINGS }
    : { to: '/mas', label: 'Más', title: 'Más opciones', subtitle: 'Todo lo que no cabe en la barra de abajo, en un solo lugar.', items: MORE_ITEMS[role] }

/** ¿La ruta pertenece a la pantalla de tarjetas? (para marcar la pestaña activa en el celular) */
export const inHub = (role: Role, pathname: string) => {
  const hub = hubFor(role)
  return pathname === hub.to || hub.items.some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`))
}

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
