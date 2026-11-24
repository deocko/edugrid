// Importe con letra para la representación impresa (pesos mexicanos).
const U = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE']
const D = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
const C = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

function under1000(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'CIEN'
  const c = Math.floor(n / 100)
  const r = n % 100
  let out = C[c] ?? ''
  if (r > 0) {
    let words: string
    if (r < 30) words = U[r] ?? ''
    else {
      const d = Math.floor(r / 10)
      const u = r % 10
      words = `${D[d] ?? ''}${u ? ` Y ${U[u] ?? ''}` : ''}`
    }
    out = `${out} ${words}`.trim()
  }
  return out
}

export function amountInWords(amount: number): string {
  const pesos = Math.floor(amount)
  const cents = Math.round((amount - pesos) * 100)
  let words: string
  if (pesos === 0) words = 'CERO'
  else {
    const millions = Math.floor(pesos / 1_000_000)
    const thousands = Math.floor((pesos % 1_000_000) / 1000)
    const rest = pesos % 1000
    const parts: string[] = []
    if (millions) parts.push(millions === 1 ? 'UN MILLÓN' : `${under1000(millions)} MILLONES`)
    if (thousands) parts.push(thousands === 1 ? 'MIL' : `${under1000(thousands).replace(/UNO$/, 'UN')} MIL`)
    if (rest) parts.push(under1000(rest))
    words = parts.join(' ')
  }
  words = words.replace(/UNO$/, 'UN')
  return `${words} ${pesos === 1 ? 'PESO' : 'PESOS'} ${String(cents).padStart(2, '0')}/100 M.N.`
}
