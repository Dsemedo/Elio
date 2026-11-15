import { useState } from 'react'
import type { ChatStatus } from '@shared/ipc'

type Props = {
  status: ChatStatus
  onStatusRefresh?: () => Promise<void>
}

type Card = {
  id: string
  title: string
  kind: 'ia' | 'app'
  status: 'ok' | 'config' | 'soon'
  detail: string
}

export function IntegrationsView({ status, onStatusRefresh }: Props): React.JSX.Element {
  const [spotifyBusy, setSpotifyBusy] = useState(false)
  const [spotifyMsg, setSpotifyMsg] = useState<string | null>(null)

  const spotifyDetail = ((): string => {
    if (!status.spotifyClientConfigured) {
      return 'Defina ELIO_SPOTIFY_CLIENT_ID (Dashboard Spotify), redirect http://127.0.0.1:47821/callback, reinicie. Play remoto exige Premium.'
    }
    if (status.spotifyConnected) {
      return 'Conta conectada (tokens cifrados neste PC). Diga “toca uma música no Spotify”. Premium necessário para controle remoto.'
    }
    return 'Client ID ok. Clique em Conectar Spotify (OAuth PKCE) ou diga “conectar Spotify”.'
  })()

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
      id: 'spotify',
      title: 'Spotify',
      kind: 'app',
      status: status.spotifyConnected
        ? 'ok'
        : status.spotifyClientConfigured
          ? 'config'
          : 'config',
      detail: spotifyDetail,
    },
    {
      id: 'weather',
      title: 'Clima (Open-Meteo)',
      kind: 'app',
      status: 'ok',
      detail:
        'Sem chave. Na 1ª pergunta de clima pede localização do Windows (cache local). Se negar, usa IP aproximado. Opcional: ELIO_WEATHER_CITY ou ELIO_WEATHER_LAT+LON. Fuso: ELIO_TIMEZONE (padrão America/Sao_Paulo).',
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

  const connectSpotify = async (): Promise<void> => {
    setSpotifyBusy(true)
    setSpotifyMsg(null)
    try {
      const result = await window.elio.connectSpotify()
      setSpotifyMsg(result.message)
      await onStatusRefresh?.()
    } catch (err) {
      setSpotifyMsg(err instanceof Error ? err.message : 'Falha ao conectar Spotify')
    } finally {
      setSpotifyBusy(false)
    }
  }

  const disconnectSpotify = async (): Promise<void> => {
    setSpotifyBusy(true)
    setSpotifyMsg(null)
    try {
      const result = await window.elio.disconnectSpotify()
      setSpotifyMsg(result.message)
      await onStatusRefresh?.()
    } catch (err) {
      setSpotifyMsg(err instanceof Error ? err.message : 'Falha ao desconectar')
    } finally {
      setSpotifyBusy(false)
    }
  }

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
            {card.id === 'spotify' ? (
              <div className="integration-actions">
                {status.spotifyConnected ? (
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={spotifyBusy}
                    onClick={() => void disconnectSpotify()}
                  >
                    Desconectar
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn primary"
                    disabled={spotifyBusy || !status.spotifyClientConfigured}
                    onClick={() => void connectSpotify()}
                  >
                    {spotifyBusy ? 'Aguardando login…' : 'Conectar Spotify'}
                  </button>
                )}
                {spotifyMsg ? <p className="integration-msg">{spotifyMsg}</p> : null}
              </div>
            ) : null}
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
