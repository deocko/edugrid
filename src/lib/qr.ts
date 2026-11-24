// Credencial QR del alumno. El QR solo lleva un código opaco (sin nombre ni datos
// personales); la escuela lo relaciona con el alumno dentro de EDUGRID.
import qrcode from 'qrcode-generator'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const PREFIX = 'EDUGRID:'

/** Genera un código nuevo de 8 caracteres que no exista ya. */
export function newQrCode(existing: Iterable<string>): string {
  const used = new Set(existing)
  const bytes = new Uint8Array(8)
  for (;;) {
    crypto.getRandomValues(bytes)
    const code = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
    if (!used.has(code)) return code
  }
}

export const qrPayload = (code: string) => `${PREFIX}${code}`

/** Muestra el código en grupos de 4 para leerlo o dictarlo: «ABCD-2345». */
export const formatQrCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`

/** Acepta lo que lea la cámara («EDUGRID:ABCD2345») o lo que se escriba a mano («abcd-2345»). */
export function parseQrInput(raw: string): string | null {
  const text = raw.trim().toUpperCase().replace(PREFIX, '').replace(/[\s-]/g, '')
  return /^[A-Z2-9]{8}$/.test(text) ? text : null
}

/** Matriz de módulos del QR (true = cuadro oscuro). */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  const n = qr.getModuleCount()
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)))
}
