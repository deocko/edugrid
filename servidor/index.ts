/**
 * Servidor Node de EDUGRID: sirve la app ya compilada (dist/) y la API (/api/datos,
 * /api/salud) con los mismos manejadores que usa Vercel. Sirve para correr EDUGRID
 * en un VPS (Coolify, Dokploy…) o en la computadora.
 *
 * - Con DATABASE_URL usa Neon (o cualquier Postgres al que llegue el driver de Neon).
 * - Sin DATABASE_URL usa Postgres en memoria (PGlite): los datos se pierden al cerrarlo.
 *
 * Uso: npm run build:servidor && npm run servidor   (abre http://localhost:3000)
 */
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { ejecutorNeon, type Ejecutor } from '../api/_lib/db'
import { manejarDatos, manejarSalud, type Entorno } from '../api/_lib/http'
import type { Database } from '../src/data/types'

let ejecutor: Ejecutor
if (process.env.DATABASE_URL) {
  ejecutor = ejecutorNeon(process.env.DATABASE_URL)
} else {
  const { PGlite } = await import('@electric-sql/pglite')
  const { ejecutorPglite } = await import('./pglite')
  ejecutor = ejecutorPglite(new PGlite())
  console.log('Sin DATABASE_URL: se usa una base Postgres en memoria (los datos se pierden al cerrar).')
}

let semilla: Database | null = null
const entorno: Entorno = {
  ejecutor: () => ejecutor,
  semilla: () => (semilla ??= JSON.parse(readFileSync('src/data/seed.json', 'utf8')) as Database),
  variables: process.env,
}

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2',
}
const puerto = Number(process.env.PORT ?? 3000)
const RUTAS = { '/api/datos': manejarDatos, '/api/salud': manejarSalud } as const

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${puerto}`)
    const api = RUTAS[url.pathname as keyof typeof RUTAS]
    if (api) {
      const trozos: Buffer[] = []
      for await (const t of req) trozos.push(t as Buffer)
      const sinCuerpo = req.method === 'GET' || req.method === 'HEAD' || trozos.length === 0
      const headers = new Headers()
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
      const r = await api(new Request(url, { method: req.method, headers, body: sinCuerpo ? undefined : Buffer.concat(trozos) }), entorno)
      res.writeHead(r.status, Object.fromEntries(r.headers))
      res.end(Buffer.from(await r.arrayBuffer()))
      return
    }
    let archivo = join('dist', normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ''))
    if (!existsSync(archivo) || statSync(archivo).isDirectory()) archivo = join('dist', 'index.html')
    res.writeHead(200, { 'content-type': TIPOS[extname(archivo)] ?? 'application/octet-stream' })
    res.end(readFileSync(archivo))
  } catch (e) {
    console.error('[edugrid-servidor]', e)
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Error del servidor')
  }
}).listen(puerto, () => console.log(`EDUGRID en http://localhost:${puerto}`))
