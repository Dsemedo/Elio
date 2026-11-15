import { useEffect, useState } from 'react'
import type { ShellState } from '@shared/ipc'

export function TopBar(): React.JSX.Element {
  const [state, setState] = useState<ShellState | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.elio.getShellState().then((s) => {
      if (!cancelled) setState(s)
    })
    const unsub = window.elio.onShellState((s) => setState(s))
    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  const open = state?.panelOpen ?? false

  return (
    <div className="top-bar-root">
      <button
        type="button"
        className={open ? 'top-bar-pill open' : 'top-bar-pill'}
        aria-expanded={open}
        aria-label={open ? 'Fechar painel Elio' : 'Abrir painel Elio'}
        onClick={() => void window.elio.togglePanel()}
      >
        <span className="top-bar-mark" aria-hidden />
        <span className="top-bar-brand">Elio</span>
        <span className="top-bar-hint">{open ? 'Fechar' : 'Abrir'}</span>
      </button>
    </div>
  )
}
