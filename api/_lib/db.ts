import { neon } from '@neondatabase/serverless'

export interface Consulta {
  text: string
  params?: unknown[]
}

/** Lo mínimo que la API necesita de Postgres. En las pruebas se usa PGlite. */
export interface Ejecutor {
  consulta(text: string, params?: unknown[]): Promise<Record<string, unknown>[]>
  /** Corre todas las consultas en una sola transacción (o se guardan todas o ninguna) y devuelve las filas de cada una. */
  transaccion(consultas: Consulta[]): Promise<Record<string, unknown>[][]>
}

export class FaltaConfiguracion extends Error {}

let cache: { url: string; ejecutor: Ejecutor } | null = null

/** Conexión a Neon por HTTPS. La cadena de conexión solo vive en la variable DATABASE_URL del hosting. */
export function ejecutorNeon(url: string | undefined): Ejecutor {
  if (!url) throw new FaltaConfiguracion('Falta configurar DATABASE_URL en Vercel.')
  if (cache?.url === url) return cache.ejecutor
  const sql = neon(url)
  const ejecutor: Ejecutor = {
    consulta: async (text, params = []) => (await sql.query(text, params)) as Record<string, unknown>[],
    transaccion: async (consultas) => {
      if (consultas.length === 0) return []
      return (await sql.transaction(consultas.map((c) => sql.query(c.text, c.params ?? [])))) as Record<string, unknown>[][]
    },
  }
  cache = { url, ejecutor }
  return ejecutor
}
