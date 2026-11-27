/**
 * Exportar una lista a Excel (.xlsx) con las mismas columnas que se ven en pantalla
 * y solo las filas que dejan los filtros. En la demo, el archivo y la hoja dicen DEMO.
 */
export type Celda = string | number
export interface Exportacion {
  /** Nombre base del archivo, sin extensión (por ejemplo «alumnos»). */
  archivo: string
  /** Nombre de la hoja (máximo 31 caracteres en Excel). */
  hoja: string
  columnas: string[]
  filas: Celda[][]
}

const limpio = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const nombreArchivo = (e: Exportacion, fecha: string, demo: boolean) => `${limpio(e.archivo)}-${fecha}${demo ? '-DEMO' : ''}.xlsx`

export async function libroExcel(e: Exportacion, demo: boolean): Promise<Blob> {
  const XLSX = await import('xlsx')
  const filas = demo ? [...e.filas, [], ['DEMO: datos ficticios del Colegio Demo EDUGRID.']] : e.filas
  const hoja = XLSX.utils.aoa_to_sheet([e.columnas, ...filas])
  hoja['!cols'] = e.columnas.map((c, i) => ({ wch: Math.min(60, Math.max(c.length + 2, ...e.filas.map((f) => String(f[i] ?? '').length + 2))) }))
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, `${e.hoja}${demo ? ' (DEMO)' : ''}`.slice(0, 31))
  const datos = XLSX.write(libro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new Blob([datos], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
