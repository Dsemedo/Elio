import type { ChatStatus, ConversationSummary } from '@shared/ipc'

type Props = {
  status: ChatStatus
  appVersion: string
  summaries: ConversationSummary[]
  onOpenConversas: () => void
  onOpenConfig: () => void
}

export function HomeView({
  status,
  appVersion,
  summaries,
  onOpenConversas,
  onOpenConfig,
}: Props): React.JSX.Element {
  const providerLabel =
    status.preferredProvider === 'none'
      ? 'Nenhum provedor'
      : status.preferredProvider === 'ollama'
        ? 'Ollama'
        : 'OpenRouter'

  return (
    <section className="panel-section home-view">
      <header className="section-header">
        <div>
          <h1>Início</h1>
          <p className="section-lede">Resumo rápido do Elio neste PC.</p>
        </div>
        <span className="badge muted">v{appVersion}</span>
      </header>

      <div className="home-grid">
        <article className="home-tile">
          <h2>Provedor</h2>
          <p className="home-value">{providerLabel}</p>
          <p className="stat-sub">{status.hint}</p>
          <button type="button" className="btn ghost" onClick={onOpenConfig}>
            Configurações
          </button>
        </article>

        <article className="home-tile">
          <h2>Conversas</h2>
          <p className="home-value">{summaries.length}</p>
          <p className="stat-sub">Salvas localmente neste computador.</p>
          <button type="button" className="btn primary" onClick={onOpenConversas}>
            Abrir conversas
          </button>
        </article>

        <article className="home-tile">
          <h2>Floating Bar</h2>
          <p className="stat-sub">
            Use a barra no topo para perguntar ou falar sem abrir este painel. Expanda
            pelo ícone □ ou pelo menu.
          </p>
        </article>
      </div>
    </section>
  )
}
