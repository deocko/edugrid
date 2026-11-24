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
 * Día simulado de la demo. Todas las pantallas usan esta fecha como "hoy" para que
 * los datos no se contradigan según el día en que alguien abra la demo.
 */
export const DEMO_TODAY = '2026-11-24'

export const todayISO = () => DEMO_TODAY

/** Fecha simulada con la hora local actual (nunca en el futuro respecto al día de la demo). */
export const nowISO = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${DEMO_TODAY}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** Fecha simulada como objeto Date (mediodía local). */
export const demoDate = () => new Date(`${DEMO_TODAY}T12:00:00`)

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
