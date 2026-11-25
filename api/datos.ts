import { entorno } from './_entorno.js'
import { manejarDatos } from './_lib/http.js'

export const GET = (req: Request) => manejarDatos(req, entorno)
export const POST = (req: Request) => manejarDatos(req, entorno)
export const OPTIONS = (req: Request) => manejarDatos(req, entorno)
