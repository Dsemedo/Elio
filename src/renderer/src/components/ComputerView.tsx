import { useCallback, useEffect, useState } from 'react'
import type { SystemSnapshot } from '@shared/ipc'

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(0)} MB`
}

function formatUptime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 48) return `${Math.floor(h / 24)} d ${h % 24} h`
  if (h > 0) return `${h} h ${m} min`
  return `${m} min`
}

export function ComputerView(): React.JSX.Element {
  const [snap, setSnap] = useState<SystemSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      setSnap(await window.elio.getSystemSnapshot())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao ler o sistema')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const id = setInterval(() => void refresh(), 5000)
    return () => clearInterval(id)
  }, [refresh])

  return (
    <section className="panel-section computer-view">
      <header className="section-header">
        <div>
          <h1>Computador</h1>
          <p className="section-lede">Visão básica do sistema neste PC.</p>
        </div>
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={() => void refresh()}
        >
          Atualizar
        </button>
      </header>

      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}

      {!snap && !error ? <p className="empty-inline">Lendo sistema…</p> : null}

      {snap ? (
        <>
          <div className="stat-grid">
            <article className="stat-block">
              <h2>Sistema</h2>
              <p>
                {snap.platform} {snap.release} · {snap.arch}
              </p>
              <p className="stat-sub">{snap.hostname}</p>
              <p className="stat-sub">Ligado há {formatUptime(snap.uptimeSec)}</p>
            </article>

            <article className="stat-block">
              <h2>Memória</h2>
              <p className="stat-big">{snap.memUsedPercent.toFixed(1)}%</p>
              <p className="stat-sub">
                {formatBytes(snap.usedMemBytes)} de {formatBytes(snap.totalMemBytes)} em
                uso
              </p>
              <div className="meter" aria-hidden>
                <div
                  className="meter-fill"
                  style={{ width: `${snap.memUsedPercent}%` }}
                />
              </div>
            </article>

            <article className="stat-block">
              <h2>CPU</h2>
              <p className="stat-big">
                {snap.cpuLoadPercent === null
                  ? '—'
                  : `${snap.cpuLoadPercent.toFixed(1)}%`}
              </p>
              <p className="stat-sub">
                {snap.cpuCount} núcleos · {snap.cpuModel}
              </p>
              <div className="meter" aria-hidden>
                <div
                  className="meter-fill"
                  style={{ width: `${snap.cpuLoadPercent ?? 0}%` }}
                />
              </div>
            </article>
          </div>

          <p className="section-note">{snap.note}</p>
        </>
      ) : null}
    </section>
  )
}
