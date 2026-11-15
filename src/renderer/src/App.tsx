import { TopBar } from './components/TopBar'
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

/** Entrada única: barrinha overlay ou painel completo (query ?surface=). */
export default function App(): React.JSX.Element {
  const surface = resolveSurface()
  if (surface === 'bar') return <TopBar />
  return <PanelShell />
}
