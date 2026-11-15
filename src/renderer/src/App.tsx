import { FloatingBar } from './components/FloatingBar'
import { PanelShell } from './components/PanelShell'

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

/** Entrada única: Floating Bar ou Command Center (?surface=). */
export default function App(): React.JSX.Element {
  const surface = resolveSurface()
  if (surface === 'bar') return <FloatingBar />
  return <PanelShell />
}
