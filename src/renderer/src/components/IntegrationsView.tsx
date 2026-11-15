import type { ChatStatus } from '@shared/ipc'

type Props = {
  status: ChatStatus
}

type Card = {
  id: string
  title: string
  kind: 'ia' | 'app'
  status: 'ok' | 'config' | 'soon'
  detail: string
}

export function IntegrationsView({ status }: Props): React.JSX.Element {
  const cards: Card[] = [
    {
      id: 'ollama',
      title: 'Ollama',
      kind: 'ia',
      status: status.ollamaAvailable ? 'ok' : 'config',
      detail: status.ollamaAvailable
        ? 'Detectado neste PC — prioridade do roteador.'
        : 'Não detectado. Instale/abra o Ollama para respostas locais.',
    },
    {
      id: 'openrouter',
      title: 'OpenRouter',
      kind: 'ia',
      status: status.openRouterConfigured ? 'ok' : 'config',
      detail: status.openRouterConfigured
        ? 'Chave configurada via ambiente (fallback).'
        : 'Opcional: defina OPENROUTER_API_KEY no terminal antes do npm run dev.',
    },
    {
      id: 'weather',
      title: 'Clima (Open-Meteo)',
      kind: 'app',
      status: 'ok',
      detail:
        'Sem chave. Padrão: São Paulo. Defina ELIO_WEATHER_CITY (ex.: Campinas) ou ELIO_WEATHER_LAT + ELIO_WEATHER_LON antes do npm run dev. Fuso: ELIO_TIMEZONE (padrão America/Sao_Paulo).',
    },
    {
      id: 'slack',
      title: 'Slack',
      kind: 'app',
      status: 'soon',
      detail: 'Em breve — OAuth e leitura de canais ficam numa fatia seguinte.',
    },
    {
      id: 'jira',
      title: 'Jira',
      kind: 'app',
      status: 'soon',
      detail: 'Em breve — conexão com projetos e issues ainda não está neste pedaço.',
    },
  ]

  return (
    <section className="panel-section integrations-view">
      <header className="section-header">
        <div>
          <h1>Integrações</h1>
          <p className="section-lede">
            Contas de IA e apps. Stubs honestos onde ainda não há OAuth.
          </p>
        </div>
      </header>

      <div className="integration-grid">
        {cards.map((card) => (
          <article key={card.id} className="integration-card">
            <header>
              <span className="integration-kind">
                {card.kind === 'ia' ? 'IA' : 'App'}
              </span>
              <h2>{card.title}</h2>
            </header>
            <p>{card.detail}</p>
            <footer>
              {card.status === 'ok' ? (
                <span className="badge accent">conectado</span>
              ) : card.status === 'soon' ? (
                <span className="badge muted">em breve</span>
              ) : (
                <span className="badge muted">configurar</span>
              )}
            </footer>
          </article>
        ))}
      </div>
    </section>
  )
}
