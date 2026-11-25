import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Database } from '../src/data/types'
import { ejecutorNeon } from './_lib/db.js'
import type { Entorno } from './_lib/http.js'

let semilla: Database | null = null

/** Entorno real en Vercel: Neon por DATABASE_URL y la semilla DEMO del repositorio. */
export const entorno: Entorno = {
  ejecutor: () => ejecutorNeon(process.env.DATABASE_URL),
  semilla: () => (semilla ??= JSON.parse(readFileSync(join(process.cwd(), 'src/data/seed.json'), 'utf8')) as Database),
  variables: process.env,
}
