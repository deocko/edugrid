import { entorno } from '../_entorno.js'
import { manejarCuenta } from '../_lib/http.js'

// /api/cuenta/<acción>: iniciar sesión, alta de escuela, invitaciones… (ver api/_lib/http.ts)
export const GET = (req: Request) => manejarCuenta(req, entorno)
export const POST = (req: Request) => manejarCuenta(req, entorno)
export const OPTIONS = (req: Request) => manejarCuenta(req, entorno)
