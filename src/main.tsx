import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'
import { StoreProvider } from './state/StoreProvider'

// El navegador no debe recordar a media página la posición al regresar: cada página empieza arriba.
try {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
} catch {
  // algunos navegadores incrustados no lo permiten
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* la app funciona igual sin service worker */
    })
  })
}
