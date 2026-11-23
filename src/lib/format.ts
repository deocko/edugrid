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

export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const nowISO = () => new Date().toISOString().slice(0, 19)

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
