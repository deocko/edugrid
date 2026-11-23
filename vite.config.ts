import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Se publica en GitHub Pages bajo /edugrid/
export default defineConfig({
  base: '/edugrid/',
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 900,
  },
})
