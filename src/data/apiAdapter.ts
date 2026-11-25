import type { EdugridRepository } from './repository'
import type { Database, Meta, TableName, Tables } from './types'

const clone = <T,>(value: T): T => structuredClone(value)

/** Separa los campos con valor de los que se borran (`undefined`), porque JSON no envía `undefined`. */
function separar(patch: object): { cambios: Record<string, unknown>; quitar: string[] } {
  const cambios: Record<string, unknown> = {}
  const quitar: string[] = []
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) quitar.push(k)
    else cambios[k] = v
  }
  return { cambios, quitar }
}

/**
 * Adaptador en línea: lee y guarda en la base de datos (Neon Postgres) por medio
 * de la API de EDUGRID (`/api/datos`). Mantiene una copia en memoria para que la
 * app responda rápido y la vuelve a pedir al servidor cada cierto tiempo para ver
 * los cambios de otras personas.
 */
export class ApiRepository implements EdugridRepository {
  readonly name = 'Base de datos en línea'
  private cache: Database | null = null
  private cargadoEn = 0
  private readonly base: string
  private readonly vigenciaMs: number

  constructor(base: string, vigenciaMs = 30_000) {
    this.base = base.replace(/\/+$/, '')
    this.vigenciaMs = vigenciaMs
  }

  private async pedir<T>(init?: RequestInit): Promise<T> {
    let res: Response
    try {
      res = await fetch(`${this.base}/datos`, { ...init, headers: { 'content-type': 'application/json' } })
    } catch {
      throw new Error('Sin conexión con el servidor de EDUGRID. Revisa tu internet e intenta de nuevo.')
    }
    const cuerpo = (await res.json().catch(() => null)) as { error?: string } | null
    if (!res.ok) throw new Error(cuerpo?.error ?? `El servidor respondió con error ${res.status}.`)
    return cuerpo as T
  }

  private async enviar(operacion: Record<string, unknown>): Promise<void> {
    try {
      await this.pedir({ method: 'POST', body: JSON.stringify(operacion) })
    } catch (e) {
      // Si algo falló, la próxima lectura vuelve a traer lo que de verdad quedó guardado.
      this.cargadoEn = 0
      throw e
    }
  }

  private async datos(): Promise<Database> {
    if (!this.cache || Date.now() - this.cargadoEn > this.vigenciaMs) {
      this.cache = await this.pedir<Database>()
      this.cargadoEn = Date.now()
    }
    return this.cache
  }

  private filas(table: TableName): { id: string }[] | null {
    return this.cache ? (this.cache[table] as unknown as { id: string }[]) : null
  }

  async snapshot(): Promise<Database> {
    return clone(await this.datos())
  }

  async list<K extends TableName>(table: K): Promise<Tables[K][]> {
    return clone((await this.datos())[table]) as Tables[K][]
  }

  async insert<K extends TableName>(table: K, rows: Tables[K][]): Promise<void> {
    await this.enviar({ op: 'insert', tabla: table, filas: rows })
    this.ponerFilas(table, rows as unknown as { id: string }[])
  }

  async upsert<K extends TableName>(table: K, rows: Tables[K][]): Promise<void> {
    await this.enviar({ op: 'upsert', tabla: table, filas: rows })
    this.ponerFilas(table, rows as unknown as { id: string }[])
  }

  /** En la base, insertar un `id` que ya existe lo reemplaza; la copia local hace lo mismo. */
  private ponerFilas(table: TableName, rows: { id: string }[]) {
    const list = this.filas(table)
    if (!list) return
    for (const row of rows) {
      const idx = list.findIndex((r) => r.id === row.id)
      if (idx >= 0) list[idx] = clone(row)
      else list.push(clone(row))
    }
  }

  async update<K extends TableName>(table: K, id: string, patch: Partial<Tables[K]>): Promise<void> {
    await this.enviar({ op: 'update', tabla: table, id, ...separar(patch) })
    const list = this.filas(table)
    const idx = list ? list.findIndex((r) => r.id === id) : -1
    if (list && idx >= 0) list[idx] = JSON.parse(JSON.stringify({ ...list[idx], ...patch })) as { id: string }
  }

  async remove<K extends TableName>(table: K, id: string): Promise<void> {
    await this.enviar({ op: 'remove', tabla: table, id })
    const list = this.filas(table)
    if (list && this.cache) (this.cache as unknown as Record<TableName, { id: string }[]>)[table] = list.filter((r) => r.id !== id)
  }

  async updateMeta(patch: Partial<Meta>): Promise<void> {
    await this.enviar({ op: 'meta', ...separar(patch) })
    if (this.cache) this.cache.meta = JSON.parse(JSON.stringify({ ...this.cache.meta, ...patch })) as Meta
  }

  async reset(): Promise<void> {
    await this.enviar({ op: 'reiniciar' })
    this.cache = null
  }
}

/**
 * Dirección de la API. En Vercel se usa «/api» automáticamente; en GitHub Pages
 * queda vacía y la app sigue con los datos guardados en el navegador.
 */
export const apiUrl = (): string => (import.meta.env.VITE_EDUGRID_API ?? '').trim()
