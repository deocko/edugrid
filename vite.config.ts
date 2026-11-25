import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// En Vercel (VERCEL=1 al compilar) o con el servidor Node (npm run build:servidor)
// la app vive en la raíz del dominio y usa la API /api con la base de datos.
// En GitHub Pages se publica bajo /edugrid/ y guarda los datos demo en el navegador.
const conApi = Boolean(process.env.VERCEL || process.env.EDUGRID_CON_API)
if (conApi && process.env.VITE_EDUGRID_API === undefined) process.env.VITE_EDUGRID_API = '/api'

export default defineConfig({
  base: conApi ? '/' : '/edugrid/',
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 900,
  },
})
