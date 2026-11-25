/**
 * Envío de correos de EDUGRID con adaptadores, igual que el CFDI (src/cfdi/pac.ts):
 * las pantallas y la API solo conocen `AdaptadorCorreo`.
 *
 * - CorreoDemo (por omisión): NO envía nada. Registra el correo en el log del
 *   servidor y la API devuelve la liga para mostrarla en pantalla, así se puede
 *   probar todo el flujo sin llaves.
 * - CorreoResend: se activa solo si existe la variable de entorno RESEND_API_KEY.
 *   El remitente sale de EDUGRID_CORREO_REMITENTE (un correo del dominio propio,
 *   verificado en Resend). Las llaves nunca van en el código.
 */

export interface Mensaje {
  para: string
  asunto: string
  texto: string
  html: string
}

export interface ResultadoEnvio {
  para: string
  enviado: boolean
  /** Por qué no se envió (solo si `enviado` es false). */
  motivo?: string
}

export interface AdaptadorCorreo {
  readonly nombre: string
  /** true si no envía de verdad (las ligas se muestran en pantalla). */
  readonly demo: boolean
  enviar(mensajes: Mensaje[]): Promise<ResultadoEnvio[]>
}

export class CorreoDemo implements AdaptadorCorreo {
  readonly nombre = 'Correo demo (no envía)'
  readonly demo = true
  async enviar(mensajes: Mensaje[]): Promise<ResultadoEnvio[]> {
    for (const m of mensajes) console.log(`[edugrid-correo demo] Para: ${m.para} · ${m.asunto}\n${m.texto}`)
    return mensajes.map((m) => ({ para: m.para, enviado: false, motivo: 'Modo demo: el correo no se envía, la liga se muestra en pantalla.' }))
  }
}

export class CorreoResend implements AdaptadorCorreo {
  readonly nombre = 'Resend'
  readonly demo = false
  private readonly llave: string
  private readonly remitente: string

  constructor(llave: string, remitente: string) {
    this.llave = llave
    this.remitente = remitente
  }

  async enviar(mensajes: Mensaje[]): Promise<ResultadoEnvio[]> {
    if (!this.remitente) return mensajes.map((m) => ({ para: m.para, enviado: false, motivo: 'Falta configurar EDUGRID_CORREO_REMITENTE.' }))
    const salida: ResultadoEnvio[] = []
    // Resend acepta hasta 100 correos por petición en /emails/batch.
    for (let i = 0; i < mensajes.length; i += 100) {
      const parte = mensajes.slice(i, i + 100)
      try {
        const r = await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: { authorization: `Bearer ${this.llave}`, 'content-type': 'application/json' },
          body: JSON.stringify(parte.map((m) => ({ from: this.remitente, to: [m.para], subject: m.asunto, text: m.texto, html: m.html }))),
        })
        if (!r.ok) {
          const detalle = await r.text().catch(() => '')
          console.error('[edugrid-correo] Resend respondió', r.status, detalle.slice(0, 300))
          salida.push(...parte.map((m) => ({ para: m.para, enviado: false, motivo: `El servicio de correo respondió con error ${r.status}.` })))
        } else salida.push(...parte.map((m) => ({ para: m.para, enviado: true })))
      } catch (e) {
        console.error('[edugrid-correo] Sin conexión con Resend', e)
        salida.push(...parte.map((m) => ({ para: m.para, enviado: false, motivo: 'No se pudo conectar con el servicio de correo.' })))
      }
    }
    return salida
  }
}

/** Elige el adaptador según las variables de entorno del servidor. */
export function correoDe(variables: Record<string, string | undefined>): AdaptadorCorreo {
  const llave = (variables.RESEND_API_KEY ?? '').trim()
  if (llave) return new CorreoResend(llave, (variables.EDUGRID_CORREO_REMITENTE ?? '').trim())
  return new CorreoDemo()
}

const escapar = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)

/** Correo con un botón: invitación o recuperación de contraseña. */
export function mensajeConLiga(o: { para: string; asunto: string; saludo: string; parrafos: string[]; boton: string; liga: string; pie: string }): Mensaje {
  const texto = [o.saludo, '', ...o.parrafos, '', `${o.boton}: ${o.liga}`, '', o.pie, '', 'EDUGRID · Una escuela. Todos conectados.'].join('\n')
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f3f6fa;font-family:Arial,Helvetica,sans-serif;color:#243247">
<div style="max-width:520px;margin:0 auto;padding:24px">
<div style="background:#101d32;color:#fff;border-radius:16px 16px 0 0;padding:18px 24px;font-weight:bold;font-size:18px">EDU<span style="color:#35c5d9">GRID</span></div>
<div style="background:#fff;border-radius:0 0 16px 16px;padding:24px">
<p style="margin:0 0 12px">${escapar(o.saludo)}</p>
${o.parrafos.map((p) => `<p style="margin:0 0 12px">${escapar(p)}</p>`).join('\n')}
<p style="margin:24px 0"><a href="${escapar(o.liga)}" style="background:#1769d2;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:bold;display:inline-block">${escapar(o.boton)}</a></p>
<p style="margin:0 0 12px;font-size:13px;color:#5b6b82">Si el botón no funciona, copia esta liga en tu navegador:<br><span style="word-break:break-all">${escapar(o.liga)}</span></p>
<p style="margin:0;font-size:13px;color:#5b6b82">${escapar(o.pie)}</p>
</div>
<p style="text-align:center;font-size:12px;color:#5b6b82">EDUGRID · Una escuela. Todos conectados.</p>
</div></body></html>`
  return { para: o.para, asunto: o.asunto, texto, html }
}
