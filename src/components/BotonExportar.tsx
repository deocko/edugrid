import { useState } from 'react'
import { saveFile } from '../lib/env'
import { libroExcel, nombreArchivo, type Exportacion } from '../lib/exportar'
import { todayISO } from '../lib/format'
import { useApp } from '../state/context'
import { Button, Notice } from './ui'

/** «Exportar»: baja la lista tal como se ve (mismas columnas, mismos filtros) en .xlsx. */
export function BotonExportar({ datos }: { datos: () => Exportacion }) {
  const { esDemo } = useApp()
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const exportar = async () => {
    setAviso('')
    setOcupado(true)
    try {
      const e = datos()
      if (e.filas.length === 0) return setAviso('No hay filas para exportar con los filtros actuales.')
      const r = await saveFile(await libroExcel(e, esDemo), nombreArchivo(e, todayISO(), esDemo))
      if (r === 'no-disponible') setAviso('Este navegador no permite descargar archivos aquí. Abre EDUGRID en una pestaña normal.')
    } catch {
      setAviso('No se pudo generar el archivo de Excel. Intenta de nuevo.')
    } finally {
      setOcupado(false)
    }
  }
  return (
    <>
      <Button variant="secundario" icon="descargar" disabled={ocupado} onClick={() => void exportar()} data-exportar>
        {ocupado ? 'Exportando…' : 'Exportar'}
      </Button>
      {aviso && <Notice tone="aviso">{aviso}</Notice>}
    </>
  )
}
