import type { PGlite } from '@electric-sql/pglite'
import type { Ejecutor } from '../api/_lib/db'

/** Postgres en memoria (PGlite) con la misma forma que Neon: para pruebas y para trabajar sin internet. */
export function ejecutorPglite(pg: PGlite): Ejecutor {
  return {
    consulta: async (text, params = []) => (await pg.query<Record<string, unknown>>(text, params)).rows,
    transaccion: (qs) =>
      pg.transaction(async (tx) => {
        const salida: Record<string, unknown>[][] = []
        for (const q of qs) salida.push((await tx.query<Record<string, unknown>>(q.text, q.params ?? [])).rows)
        return salida
      }),
  }
}
