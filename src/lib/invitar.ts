import { cuentaApi } from '../data/cuenta'
import type { PersonaInvitada, ResultadoInvitacion } from '../data/cuentaTipos'
import { useApp } from '../state/context'

/** Manda las invitaciones en grupos de 200 (lo que acepta la API por petición). */
export async function enviarInvitaciones(token: string, personas: PersonaInvitada[]): Promise<ResultadoInvitacion[]> {
  const salida: ResultadoInvitacion[] = []
  for (let i = 0; i < personas.length; i += 200) salida.push(...(await cuentaApi.invitar(token, personas.slice(i, i + 200))).resultados)
  return salida
}

/** Invita a quien se dio de alta a mano. En la demo no hace nada (no hay cuentas reales). */
export function useInvitar() {
  const { cuenta } = useApp()
  return async (personas: PersonaInvitada[]): Promise<ResultadoInvitacion[]> => {
    const conCorreo = personas.filter((p) => p.correo)
    if (!cuenta || conCorreo.length === 0) return []
    try {
      return await enviarInvitaciones(cuenta.token, conCorreo)
    } catch (e) {
      return conCorreo.map((p) => ({ ...p, estado: 'error' as const, motivo: e instanceof Error ? e.message : 'No se pudo crear la invitación.' }))
    }
  }
}
