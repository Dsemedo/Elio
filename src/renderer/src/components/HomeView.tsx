import type { ChatStatus, ConversationSummary } from '@shared/ipc'

type Props = {
  status: ChatStatus
  appVersion: string
  summaries: ConversationSummary[]
  activeTitle: string | null
  onContinue: () => void
  onNew: () => void
  onOpenConfig: () => void
}

export function HomeView({
  status,
  appVersion,
  summaries,
  activeTitle,
  onContinue,
  onNew,
  onOpenConfig,
}: Props): React.JSX.Element {
  const providerLabel =
    status.preferredProvider === 'none'
      ? 'Nenhum provedor'
      : status.preferredProvider === 'ollama'
        ? 'Ollama'
        : 'OpenRouter'

  const canContinue = summaries.length > 0 && Boolean(activeTitle)

  return (
    <section className="panel-section home-view">
      <header className="section-header">
        <div>
          <h1>Início</h1>
          <p className="section-lede">Continue de onde parou ou comece outra conversa.</p>
        </div>
        <span className="badge muted">v{appVersion}</span>
      </header>

      <div className="home-actions">
        <button
          type="button"
          className="btn primary home-cta"
          disabled={!canContinue}
          onClick={onContinue}
        >
          Continuar conversa
          {activeTitle ? <span className="home-cta-sub">{activeTitle}</span> : null}
        </button>
        <button type="button" className="btn ghost home-cta" onClick={onNew}>
          Nova conversa
        </button>
      </div>

      <div className="home-status-row">
        <p>
          <span className="home-status-label">Provedor</span>
          <strong>{providerLabel}</strong>
        </p>
        <p className="stat-sub">{status.hint}</p>
        <button type="button" className="btn ghost" onClick={onOpenConfig}>
          Configurações
        </button>
      </div>
    </section>
  )
}
