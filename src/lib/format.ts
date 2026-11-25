const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
export const formatMoney = (n: number) => money.format(n)

const parse = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)

export const formatDate = (iso: string) =>
  parse(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

export const formatDateLong = (iso: string) => {
  const s = parse(iso).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const formatDateTime = (iso: string) =>
  parse(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/**
 * Día simulado de la demo. Todas las pantallas del Colegio Demo usan esta fecha como
 * "hoy" para que los datos no se contradigan según el día en que alguien abra la demo.
 * Las escuelas reales (con inicio de sesión) usan la fecha de verdad.
 */
export const DEMO_TODAY = '2026-11-24'

let fechaReal = false
/** La app la activa al entrar con una cuenta real y la apaga al volver a la demo. */
export const usarFechaReal = (real: boolean) => {
  fechaReal = real
}

const p2 = (n: number) => String(n).padStart(2, '0')
const hoyReal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}

export const todayISO = () => (fechaReal ? hoyReal() : DEMO_TODAY)

/** Fecha de hoy con la hora local actual (en la demo, el día simulado). */
export const nowISO = () => {
  const d = new Date()
  return `${todayISO()}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`
}

/** Hoy como objeto Date (mediodía local). */
export const demoDate = () => new Date(`${todayISO()}T12:00:00`)

export const uid = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`

export const DAYS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'] as const

export const ageFrom = (birthDate: string) => {
  const b = parse(birthDate)
  const n = new Date()
  let age = n.getFullYear() - b.getFullYear()
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) age--
  return age
}

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

/** Cantidad con su palabra en singular o plural: plural(1, 'grupo', 'grupos') → "1 grupo". */
export const plural = (n: number, singular: string, pluralForm: string) => `${n} ${n === 1 ? singular : pluralForm}`
