import { useState } from 'react'

type Props = {
  onAfterDeleteAll?: () => Promise<void>
}

export function DataSettingsView({ onAfterDeleteAll }: Props): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const exportData = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const payload = await window.elio.exportUserData()
      const blob = new Blob([payload.json], {
        type: 'application/json;charset=utf-8',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `elio-export-${stamp}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMessage(
        `Exportado: ${payload.conversationCount} conversa(s), ${payload.memoryCount} memória(s). Sem chaves nem tokens.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao exportar')
    } finally {
      setBusy(false)
    }
  }

  const deleteAll = async (): Promise<void> => {
    const ok = window.confirm(
      'Apagar TODOS os dados locais do Elio neste PC?\n\nIsso remove conversas, memórias, localização em cache, chave OpenRouter salva e tokens do Spotify.\n\nNão tem como desfazer.',
    )
    if (!ok) return
    const again = window.confirm('Confirma apagar tudo? Última chance.')
    if (!again) return

    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await window.elio.deleteAllUserData()
      setMessage(
        `Dados apagados. Memórias: ${result.removed.memories}. Conversas: ${
          result.removed.conversations ? 'sim' : 'não havia'
        }.`,
      )
      await onAfterDeleteAll?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao apagar dados')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel-section data-settings-view">
      <header className="section-header">
        <div>
          <h1>Dados</h1>
          <p className="section-lede">
            Tudo fica neste PC. Exporte um JSON de backup ou apague tudo.
          </p>
        </div>
      </header>

      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}
      {message ? <p className="section-note">{message}</p> : null}

      <div className="data-actions">
        <article className="data-card">
          <h2>Exportar JSON</h2>
          <p>
            Conversas, memórias e cidade do clima. Sem API keys nem tokens do Spotify.
          </p>
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => void exportData()}
          >
            Baixar export
          </button>
        </article>

        <article className="data-card danger-zone">
          <h2>Apagar tudo</h2>
          <p>
            Remove conversas, memórias, cache de localização e segredos salvos neste app.
            Whisper baixado permanece.
          </p>
          <button
            type="button"
            className="btn danger"
            disabled={busy}
            onClick={() => void deleteAll()}
          >
            Apagar todos os dados
          </button>
        </article>
      </div>
    </section>
  )
}
