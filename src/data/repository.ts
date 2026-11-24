import type { Database, Meta, TableName, Tables } from './types'

/**
 * Contrato de acceso a datos. La interfaz de usuario solo conoce este contrato,
 * así que para conectar Supabase (u otro backend) basta con escribir un nuevo
 * adaptador que lo implemente, sin tocar las pantallas.
 */
export interface EdugridRepository {
  /** Nombre legible del adaptador, por ejemplo "Local (demo)". */
  readonly name: string
  /** Devuelve una copia completa de los datos. */
  snapshot(): Promise<Database>
  list<K extends TableName>(table: K): Promise<Tables[K][]>
  insert<K extends TableName>(table: K, rows: Tables[K][]): Promise<void>
  update<K extends TableName>(table: K, id: string, patch: Partial<Tables[K]>): Promise<void>
  /** Inserta o reemplaza filas por `id`. */
  upsert<K extends TableName>(table: K, rows: Tables[K][]): Promise<void>
  remove<K extends TableName>(table: K, id: string): Promise<void>
  updateMeta(patch: Partial<Meta>): Promise<void>
  /** Vuelve a cargar los datos de ejemplo. */
  reset(): Promise<void>
}
