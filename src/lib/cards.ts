// Tarjetas de pago (DEMO). Solo se aceptan números de prueba y nunca se guarda
// el número completo ni el código de seguridad.
import type { CardBrand } from '../data/types'

export const TEST_CARDS: { brand: CardBrand; label: string; number: string }[] = [
  { brand: 'visa', label: 'Visa de prueba', number: '4242424242424242' },
  { brand: 'mastercard', label: 'Mastercard de prueba', number: '5555555555554444' },
  { brand: 'amex', label: 'American Express de prueba', number: '378282246310005' },
]

export const BRAND_LABEL: Record<CardBrand, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express' }

export const digits = (s: string) => s.replace(/\D/g, '')

export function detectBrand(num: string): CardBrand | null {
  const d = digits(num)
  if (/^4/.test(d)) return 'visa'
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'mastercard'
  if (/^3[47]/.test(d)) return 'amex'
  return null
}

export const cardLength = (brand: CardBrand | null) => (brand === 'amex' ? 15 : 16)
export const cvvLength = (brand: CardBrand | null) => (brand === 'amex' ? 4 : 3)

/** 4242 4242 4242 4242 o 3782 822463 10005 (Amex). */
export function formatCardNumber(num: string) {
  const d = digits(num).slice(0, cardLength(detectBrand(num)))
  if (detectBrand(d) === 'amex') return [d.slice(0, 4), d.slice(4, 10), d.slice(10)].filter(Boolean).join(' ')
  return d.replace(/(.{4})/g, '$1 ').trim()
}

export function luhn(num: string) {
  const d = digits(num)
  let sum = 0
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i])
    if (i % 2 === 1) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
  }
  return d.length >= 13 && sum % 10 === 0
}

export const isTestCard = (num: string) => TEST_CARDS.some((c) => c.number === digits(num))

/** "MM/AA" → { month, year } o null. */
export function parseExpiry(s: string): { month: number; year: number } | null {
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(s.trim())
  if (!m) return null
  const month = Number(m[1])
  if (month < 1 || month > 12) return null
  return { month, year: 2000 + Number(m[2]) }
}

export const isExpired = (month: number, year: number, todayISO: string) => {
  const [y, mo] = todayISO.split('-').map(Number) as [number, number]
  return year < y || (year === y && month < mo)
}

export const formatExpiry = (month: number, year: number) => `${String(month).padStart(2, '0')}/${String(year).slice(-2)}`

export function maskedNumber(brand: CardBrand | null, last4: string) {
  return brand === 'amex' ? `•••• •••••• •${last4}` : `•••• •••• •••• ${last4}`
}
