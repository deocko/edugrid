import type { EdugridRepository, EventoRepositorio } from './repository'
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

type Cambio = Record<string, unknown>

/**
 * Adaptador en línea: lee y guarda en la base de datos (Neon Postgres) por medio
 * de la API de EDUGRID (`/api/datos`).
 *
 * Para que la app no se trabe:
 * - Cada cambio se aplica al momento en la copia local y se manda al servidor
 *   en segundo plano. Los cambios que llegan juntos viajan en un solo lote
 *   (una petición, una transacción).
 * - Leer nunca espera a la red: se entrega la copia local y, si tiene más de
 *   `vigenciaMs`, se pide la versión nueva por detrás y se avisa al llegar.
 * - Si el servidor rechaza un lote, se avisa con un evento de error y se vuelve
 *   a traer lo que de verdad quedó guardado.
 */
export class ApiRepository implements EdugridRepository {
  readonly name = 'Base de datos en línea'
  private cache: Database | null = null
  private cargadoEn = 0
  private readonly base: string
  private readonly vigenciaMs: number
  /** Cambios esperando a salir en el siguiente lote. */
  private lote: Cambio[] = []
  /** Promesa del lote que se está armando (se resuelve cuando el servidor lo guarda). */
  private loteActual: Promise<void> | null = null
  /** Último lote enviado o por enviar, en orden: cada lote sale cuando terminó el anterior. */
  private cola: Promise<void> = Promise.resolve()
  private ultimo: Promise<void> = Promise.resolve()
  private enviando = 0
  /** Sube con cada cambio local: si cambió mientras se pedían datos, esos datos ya son viejos. */
  private version = 0
  private revalidando = false
  private readonly oyentes = new Set<(e: EventoRepositorio) => void>()

  constructor(base: string, vigenciaMs = 60_000) {
    this.base = base.replace(/\/+$/, '')
    this.vigenciaMs = vigenciaMs
    if (typeof document !== 'undefined')
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.vieja()) void this.revalidar()
      })
  }

  suscribir(fn: (e: EventoRepositorio) => void): () => void {
    this.oyentes.add(fn)
    return () => this.oyentes.delete(fn)
  }

  private emitir(e: EventoRepositorio) {
    for (const fn of this.oyentes) fn(e)
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

  private vieja(): boolean {
    return Date.now() - this.cargadoEn > this.vigenciaMs
  }

  private ocupada(): boolean {
    return this.lote.length > 0 || this.enviando > 0
  }

  /** Pone el cambio en el lote que sale en cuanto termine el anterior. */
  private encolar(cambio: Cambio): void {
    this.version++
    this.lote.push(cambio)
    if (this.loteActual) return
    const envio = this.cola.then(async () => {
      // Espera un instante para juntar en el mismo lote los cambios que vienen seguidos.
      await new Promise((r) => setTimeout(r, 0))
      const operaciones = this.lote
      this.lote = []
      this.loteActual = null
      this.enviando++
      try {
        await this.pedir({ method: 'POST', body: JSON.stringify({ op: 'lote', operaciones }) })
      } catch (e) {
        this.cargadoEn = 0
        this.emitir({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo guardar.' })
        throw e
      } finally {
        this.enviando--
      }
      // Si hubo un error antes, se vuelve a traer lo guardado en cuanto se vacía la cola.
      if (!this.ocupada() && this.cargadoEn === 0) void this.revalidar()
    })
    envio.catch(() => {
      if (!this.ocupada()) void this.revalidar()
    })
    this.loteActual = envio
    this.ultimo = envio
    this.cola = envio.catch(() => undefined)
  }

  /** Espera a que el servidor guarde todo lo pendiente. Falla si el último lote no se guardó. */
  confirmar(): Promise<void> {
    return this.loteActual ?? this.ultimo
  }

  /** Pide los datos al servidor por detrás y avisa si cambiaron. */
  private async revalidar(): Promise<void> {
    if (this.revalidando || this.ocupada() || !this.cache) return
    this.revalidando = true
    const version = this.version
    try {
      const db = await this.pedir<Database>()
      if (version !== this.version || this.ocupada()) return
      this.cache = db
      this.cargadoEn = Date.now()
      this.emitir({ tipo: 'datos' })
    } catch {
      // Sin red: se sigue con la copia local y se reintenta en la siguiente lectura.
    } finally {
      this.revalidando = false
    }
  }

  private async datos(): Promise<Database> {
    if (!this.cache) {
      this.cache = await this.pedir<Database>()
      this.cargadoEn = Date.now()
    } else if (this.vieja()) void this.revalidar()
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
    this.ponerFilas(table, rows as unknown as { id: string }[])
    this.encolar({ op: 'insert', tabla: table, filas: rows })
  }

  async upsert<K extends TableName>(table: K, rows: Tables[K][]): Promise<void> {
    this.ponerFilas(table, rows as unknown as { id: string }[])
    this.encolar({ op: 'upsert', tabla: table, filas: rows })
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
    const list = this.filas(table)
    const idx = list ? list.findIndex((r) => r.id === id) : -1
    if (list && idx < 0) throw new Error(`No se encontró el registro ${id}`)
    if (list) list[idx] = JSON.parse(JSON.stringify({ ...list[idx], ...patch })) as { id: string }
    this.encolar({ op: 'update', tabla: table, id, ...separar(patch) })
  }

  async remove<K extends TableName>(table: K, id: string): Promise<void> {
    const list = this.filas(table)
    if (list && this.cache) (this.cache as unknown as Record<TableName, { id: string }[]>)[table] = list.filter((r) => r.id !== id)
    this.encolar({ op: 'remove', tabla: table, id })
  }

  async updateMeta(patch: Partial<Meta>): Promise<void> {
    if (this.cache) this.cache.meta = JSON.parse(JSON.stringify({ ...this.cache.meta, ...patch })) as Meta
    this.encolar({ op: 'meta', ...separar(patch) })
  }

  async reset(): Promise<void> {
    await this.cola
    this.version++
    await this.pedir({ method: 'POST', body: JSON.stringify({ op: 'reiniciar' }) })
    this.cache = await this.pedir<Database>()
    this.cargadoEn = Date.now()
  }
}

/**
 * Dirección de la API. En Vercel se usa «/api» automáticamente; en GitHub Pages
 * queda vacía y la app sigue con los datos guardados en el navegador.
 */
export const apiUrl = (): string => (import.meta.env.VITE_EDUGRID_API ?? '').trim()
