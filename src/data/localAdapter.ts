import seed from './seed.json'
import type { EdugridRepository } from './repository'
import type { Database, Meta, TableName, Tables } from './types'

const STORAGE_KEY = 'edugrid.demo.db.v1'
const seedData = seed as unknown as Database

const clone = <T,>(value: T): T => structuredClone(value)

/** Adaptador local: guarda en localStorage y arranca con la semilla DEMO. */
export class LocalStorageRepository implements EdugridRepository {
  readonly name = 'Local (demo en este navegador)'
  private db: Database

  constructor() {
    this.db = this.read()
  }

  private read(): Database {
    let raw: string | null = null
    try {
      raw = localStorage.getItem(STORAGE_KEY)
    } catch {
      raw = null
    }
    if (!raw) return clone(seedData)
    const parsed = JSON.parse(raw) as Database
    if (!parsed.meta || parsed.meta.seedVersion !== seedData.meta.seedVersion) return clone(seedData)
    return parsed
  }

  /** Acceso interno sin tipos por tabla: todas las filas tienen `id`. */
  private rows(table: TableName): { id: string }[] {
    return this.db[table] as unknown as { id: string }[]
  }

  private setRows(table: TableName, rows: { id: string }[]) {
    ;(this.db as unknown as Record<TableName, { id: string }[]>)[table] = rows
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.db))
    } catch {
      // Si el navegador no permite guardar (modo privado), la demo sigue en memoria.
    }
  }

  async snapshot(): Promise<Database> {
    return clone(this.db)
  }

  async list<K extends TableName>(table: K): Promise<Tables[K][]> {
    return clone(this.db[table]) as Tables[K][]
  }

  async insert<K extends TableName>(table: K, rows: Tables[K][]): Promise<void> {
    this.rows(table).push(...(clone(rows) as unknown as { id: string }[]))
    this.persist()
  }

  async update<K extends TableName>(table: K, id: string, patch: Partial<Tables[K]>): Promise<void> {
    const list = this.rows(table)
    const idx = list.findIndex((r) => r.id === id)
    if (idx < 0) throw new Error(`No se encontró el registro ${id}`)
    list[idx] = { ...list[idx], ...(clone(patch) as object) } as { id: string }
    this.persist()
  }

  async upsert<K extends TableName>(table: K, rows: Tables[K][]): Promise<void> {
    const list = this.rows(table)
    for (const row of rows as unknown as { id: string }[]) {
      const idx = list.findIndex((r) => r.id === row.id)
      if (idx >= 0) list[idx] = clone(row)
      else list.push(clone(row))
    }
    this.persist()
  }

  async remove<K extends TableName>(table: K, id: string): Promise<void> {
    this.setRows(table, this.rows(table).filter((r) => r.id !== id))
    this.persist()
  }

  async updateMeta(patch: Partial<Meta>): Promise<void> {
    this.db.meta = { ...this.db.meta, ...clone(patch) }
    this.persist()
  }

  async reset(): Promise<void> {
    this.db = clone(seedData)
    this.persist()
  }
}
