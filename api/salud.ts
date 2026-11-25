import { entorno } from './_entorno.js'
import { manejarSalud } from './_lib/http.js'

export const GET = (req: Request) => manejarSalud(req, entorno)
