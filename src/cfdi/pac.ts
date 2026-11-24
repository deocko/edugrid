/**
 * Adaptador PAC (Proveedor Autorizado de Certificación).
 *
 * En México el timbrado NO se hace directo con el SAT: se envía el CFDI sellado a
 * un PAC autorizado, que lo valida, le agrega el Timbre Fiscal Digital (UUID) y lo
 * reporta al SAT. Para timbrar de verdad la escuela necesita:
 *   1. Su Certificado de Sello Digital (CSD) vigente (.cer, .key y contraseña).
 *   2. Un contrato con un PAC y las credenciales de su API.
 *
 * Esta interfaz es la única pieza que hay que implementar para conectar un PAC
 * real. Las credenciales NUNCA deben vivir en el navegador ni en el repositorio:
 * el adaptador real debe llamar a un servidor propio (por ejemplo una función de
 * Supabase) que guarde el CSD y las llaves del PAC de forma segura.
 */

import { nowISO } from '../lib/format'

export interface ResultadoTimbrado {
  uuid: string
  fechaTimbrado: string
  rfcProvCertif: string
  noCertificadoSAT: string
  selloSAT: string
  /** XML completo ya con el Timbre Fiscal Digital. */
  xmlTimbrado: string
}

export interface SolicitudCancelacion {
  uuid: string
  rfcEmisor: string
  total: number
  motivo: '01' | '02' | '03' | '04'
  folioSustitucion?: string
}

export interface ResultadoCancelacion {
  uuid: string
  estatus: 'Cancelado' | 'En proceso' | 'Rechazado'
  fecha: string
  acuse: string
}

export interface ResultadoConsulta {
  uuid: string
  estado: 'Vigente' | 'Cancelado' | 'No encontrado'
  esCancelable: 'Cancelable sin aceptación' | 'Cancelable con aceptación' | 'No cancelable'
}

export interface PacAdapter {
  readonly id: string
  readonly nombre: string
  readonly esDemo: boolean
  timbrar(xmlSellado: string): Promise<ResultadoTimbrado>
  cancelar(solicitud: SolicitudCancelacion): Promise<ResultadoCancelacion>
  consultar(uuid: string): Promise<ResultadoConsulta>
}

const randomHex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('')
const randomB64 = (bytes: number) => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes))))
const nowLocal = () => nowISO()

/** PAC de demostración: no se conecta a nada. Genera un timbre ficticio marcado como DEMO. */
export class DemoPacAdapter implements PacAdapter {
  readonly id = 'demo'
  readonly nombre = 'PAC de demostración (sin conexión)'
  readonly esDemo = true
  private estados = new Map<string, ResultadoConsulta['estado']>()

  async timbrar(xmlSellado: string): Promise<ResultadoTimbrado> {
    await new Promise((r) => setTimeout(r, 350))
    const h = randomHex(16).toUpperCase()
    const uuid = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-A${h.slice(17, 20)}-${h.slice(20, 32)}`
    const fechaTimbrado = nowLocal()
    const selloCFD = /Sello="([^"]*)"/.exec(xmlSellado)?.[1] ?? ''
    const selloSAT = `DEMO${randomB64(96)}`
    const rfcProvCertif = 'DEMO000000PAC'
    const noCertificadoSAT = '00000000000000000000'
    const tfd = `<tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" xsi:schemaLocation="http://www.sat.gob.mx/TimbreFiscalDigital http://www.sat.gob.mx/sitio_internet/cfd/TimbreFiscalDigital/TimbreFiscalDigitalv11.xsd" Version="1.1" UUID="${uuid}" FechaTimbrado="${fechaTimbrado}" RfcProvCertif="${rfcProvCertif}" SelloCFD="${selloCFD}" NoCertificadoSAT="${noCertificadoSAT}" SelloSAT="${selloSAT}"/>`
    const xmlTimbrado = xmlSellado.replace('</cfdi:Comprobante>', `  <cfdi:Complemento>\n    ${tfd}\n  </cfdi:Complemento>\n</cfdi:Comprobante>`)
    this.estados.set(uuid, 'Vigente')
    return { uuid, fechaTimbrado, rfcProvCertif, noCertificadoSAT, selloSAT, xmlTimbrado }
  }

  async cancelar(s: SolicitudCancelacion): Promise<ResultadoCancelacion> {
    await new Promise((r) => setTimeout(r, 250))
    this.estados.set(s.uuid, 'Cancelado')
    return { uuid: s.uuid, estatus: 'Cancelado', fecha: nowLocal(), acuse: `ACUSE-DEMO-${randomHex(6).toUpperCase()}` }
  }

  async consultar(uuid: string): Promise<ResultadoConsulta> {
    const estado = this.estados.get(uuid) ?? 'Vigente'
    return { uuid, estado, esCancelable: estado === 'Vigente' ? 'Cancelable sin aceptación' : 'No cancelable' }
  }
}

/**
 * Plantilla para un PAC real. Implementa los tres métodos llamando a TU servidor
 * (nunca directo desde el navegador con llaves del PAC). Mientras no exista,
 * cualquier intento de uso falla con un mensaje claro.
 */
export class PacRealPendiente implements PacAdapter {
  readonly esDemo = false
  constructor(
    readonly id: string,
    readonly nombre: string,
  ) {}
  private noDisponible(): never {
    throw new Error(`El PAC "${this.nombre}" aún no está conectado. Se necesita contrato con el PAC, CSD vigente de la escuela y un servidor seguro.`)
  }
  async timbrar(): Promise<ResultadoTimbrado> {
    this.noDisponible()
  }
  async cancelar(): Promise<ResultadoCancelacion> {
    this.noDisponible()
  }
  async consultar(): Promise<ResultadoConsulta> {
    this.noDisponible()
  }
}

let demo: DemoPacAdapter | null = null

/** Devuelve el adaptador configurado. En esta versión siempre es el de demostración. */
export function getPacAdapter(provider: string): PacAdapter {
  if (provider !== 'demo') return new PacRealPendiente(provider, provider)
  demo ??= new DemoPacAdapter()
  return demo
}
