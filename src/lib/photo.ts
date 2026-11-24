// Fotos que envía la docente: se reducen en el navegador antes de guardarlas
// para que pesen poco (lado mayor 720 px, JPEG ~60 KB).
export async function compressPhoto(file: File, maxSide = 720, quality = 0.7): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('El archivo no es una imagen.')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('No se pudo abrir la foto.'))
      i.src = url
    })
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No se pudo procesar la foto.')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** En la demo se guardan como máximo estas fotos (el navegador tiene poco espacio). */
export const MAX_DEMO_PHOTOS = 20
