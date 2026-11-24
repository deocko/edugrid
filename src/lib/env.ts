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
