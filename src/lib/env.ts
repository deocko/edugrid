/**
 * ¿Puede la página descargar archivos? Dentro de una vista previa incrustada (por ejemplo,
 * el artefacto de la demo) el navegador bloquea las descargas, así que avisamos en vez de fallar.
 */
export const canDownloadFiles = () => {
  try {
    return window.self === window.top
  } catch {
    return false
  }
}

interface DownloadsApi {
  save: (file: { filename: string; data: Blob }) => Promise<unknown>
}
type EmbedHost = { use?: (name: string) => Promise<unknown> }

let downloadsApi: Promise<DownloadsApi | null> | null = null
/**
 * Cuando la demo corre incrustada en una vista previa que ofrece guardar archivos, pide ese
 * permiso al anfitrión. Responde null si el anfitrión no lo ofrece (o tarda más de 10 s).
 */
export const embeddedDownloads = () => {
  if (!downloadsApi) {
    const host = (window as unknown as { claude?: EmbedHost }).claude
    downloadsApi = host?.use
      ? Promise.race([
          host.use('downloads').then((d) => (d && typeof (d as DownloadsApi).save === 'function' ? (d as DownloadsApi) : null)).catch(() => null),
          new Promise<null>((r) => setTimeout(() => r(null), 10_000)),
        ])
      : Promise.resolve(null)
  }
  return downloadsApi
}

export type SaveResult = 'ok' | 'cancelado' | 'no-disponible'

/** Guarda un archivo generado en el navegador: descarga directa o, incrustada, con el permiso del anfitrión. */
export async function saveFile(blob: Blob, filename: string): Promise<SaveResult> {
  if (canDownloadFiles()) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return 'ok'
  }
  const api = await embeddedDownloads()
  if (!api) return 'no-disponible'
  try {
    await api.save({ filename, data: blob })
    return 'ok'
  } catch (e) {
    const code = (e as { code?: string } | null)?.code
    return code === 'unavailable' || code === 'not_granted' ? 'no-disponible' : 'cancelado'
  }
}
