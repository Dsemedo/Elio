import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

function resolveSurface(): 'bar' | 'panel' {
  try {
    const params = new URLSearchParams(window.location.search)
    const surface = params.get('surface')
    if (surface === 'bar' || surface === 'panel') return surface
  } catch {
    /* ignore */
  }
  return 'panel'
}

const surface = resolveSurface()
document.documentElement.dataset.surface = surface
if (surface === 'bar') {
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'
}

const root = document.getElementById('root')
if (!root) {
  throw new Error('Elemento #root não encontrado')
}
if (surface === 'bar') {
  root.style.background = 'transparent'
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
