import { useEffect, useState } from 'react'
import type { AppInfo } from '@shared/ipc'

export default function App(): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void window.elio
      .getAppInfo()
      .then((data) => {
        if (!cancelled) setInfo(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Falha ao ler info do app')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="shell">
      <div className="glow" aria-hidden="true" />
      <section className="hero">
        <p className="eyebrow">Fundação técnica · Sprint 0</p>
        <h1 className="brand">Elio</h1>
        <p className="lede">
          Olá — a base desktop está no ar. Isolamento do renderer ativo, sem chat e
          sem voz ainda. Este é o ponto de partida do JARVIS MVP.
        </p>
        <div className="meta" role="status">
          {error ? (
            <span className="meta-error">{error}</span>
          ) : info ? (
            <>
              <span>
                v{info.version} · Electron {info.electron}
              </span>
              <span className="dot" aria-hidden="true">
                ·
              </span>
              <span>{info.platform}</span>
            </>
          ) : (
            <span>Carregando…</span>
          )}
        </div>
      </section>
    </main>
  )
}
