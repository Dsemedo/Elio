import { useEffect, useState } from 'react'
import type { AppInfo } from '@shared/ipc'

export default function App(): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const api = window.elio
    if (!api?.getAppInfo) {
      setError('Bridge do app indisponível (preload).')
      return
    }

    void api
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
        <p className="eyebrow">Fundação · base do app</p>
        <h1 className="brand">Elio</h1>
        <p className="lede">
          Olá — a base desktop está no ar. Por enquanto não há chat nem voz: isto
          só confirma que o programa abre com segurança. O próximo passo natural é
          conversar por texto.
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
