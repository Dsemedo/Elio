import { useEffect, useState } from 'react'
import type { ChatStatus, SettingsPublic, TtsPreference, TtsSettings } from '@shared/ipc'
import { ttsController } from '../lib/ttsController'

type Props = {
  status: ChatStatus
  onStatusRefresh?: () => Promise<void>
}

export function IntegrationsView({ status, onStatusRefresh }: Props): React.JSX.Element {
  const [settings, setSettings] = useState<SettingsPublic | null>(null)
  const [ollamaHost, setOllamaHost] = useState('')
  const [ollamaModel, setOllamaModel] = useState('')
  const [openRouterModel, setOpenRouterModel] = useState('')
  const [weatherCity, setWeatherCity] = useState('')
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [spotifyBusy, setSpotifyBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [spotifyMsg, setSpotifyMsg] = useState<string | null>(null)
  const [tts, setTts] = useState<TtsSettings | null>(null)
  const [ttsBusy, setTtsBusy] = useState(false)
  const [ttsSpeaking, setTtsSpeaking] = useState(false)

  const loadSettings = async (): Promise<void> => {
    const next = await window.elio.getSettings()
    setSettings(next)
    setOllamaHost(next.ollamaHost)
    setOllamaModel(next.ollamaModel)
    setOpenRouterModel(next.openRouterModel)
    setWeatherCity(next.weatherCity)
  }

  useEffect(() => {
    void loadSettings().catch((err) => {
      setMessage(err instanceof Error ? err.message : 'Falha ao carregar configurações')
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    void ttsController.ensureBoot().then((s) => {
      if (!cancelled) setTts(s)
    })
    const unsub = ttsController.subscribe((snap) => {
      if (!cancelled) {
        setTts(snap.settings)
        setTtsSpeaking(snap.ui === 'speaking')
      }
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  const savePrefs = async (): Promise<void> => {
    setBusy(true)
    setMessage(null)
    try {
      const next = await window.elio.updateSettings({
        ollamaHost,
        ollamaModel,
        openRouterModel,
        weatherCity,
      })
      setSettings(next)
      setMessage('Preferências salvas neste PC.')
      await onStatusRefresh?.()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Falha ao salvar')
    } finally {
      setBusy(false)
    }
  }

  const probeOllama = async (): Promise<void> => {
    setBusy(true)
    setMessage(null)
    try {
      await window.elio.updateSettings({ ollamaHost, ollamaModel })
      const result = await window.elio.probeOllama()
      setMessage(result.message)
      await onStatusRefresh?.()
      await loadSettings()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Falha ao verificar Ollama')
    } finally {
      setBusy(false)
    }
  }

  const saveOpenRouterKey = async (): Promise<void> => {
    setBusy(true)
    setMessage(null)
    try {
      const next = await window.elio.setOpenRouterKey({ apiKey: apiKeyDraft })
      setSettings(next)
      setApiKeyDraft('')
      setMessage('Chave OpenRouter salva no cofre deste PC.')
      await onStatusRefresh?.()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Falha ao salvar chave')
    } finally {
      setBusy(false)
    }
  }

  const clearOpenRouterKey = async (): Promise<void> => {
    setBusy(true)
    setMessage(null)
    try {
      const next = await window.elio.clearOpenRouterKey()
      setSettings(next)
      setMessage(
        next.openRouterKeySource === 'env'
          ? 'Cofre limpo. Ainda há OPENROUTER_API_KEY no ambiente.'
          : 'Chave removida do cofre.',
      )
      await onStatusRefresh?.()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Falha ao remover chave')
    } finally {
      setBusy(false)
    }
  }

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

  const toggleTts = async (): Promise<void> => {
    setTtsBusy(true)
    try {
      const updated = await ttsController.setEnabled(!(tts?.enabled ?? false))
      setTts(updated)
    } finally {
      setTtsBusy(false)
    }
  }

  const setTtsProvider = async (provider: TtsPreference): Promise<void> => {
    setTtsBusy(true)
    try {
      const updated = await ttsController.setProvider(provider)
      setTts(updated)
    } finally {
      setTtsBusy(false)
    }
  }

  const openRouterStatus = settings?.openRouterKeyConfigured
    ? 'ok'
    : status.openRouterConfigured
      ? 'ok'
      : 'config'
  const ollamaStatus = status.ollamaAvailable ? 'ok' : 'config'

  return (
    <section className="panel-section integrations-view">
      <header className="section-header">
        <div>
          <h1>Integrações</h1>
          <p className="section-lede">
            Configure o cérebro (IA) neste app — sem precisar editar o terminal.
          </p>
        </div>
      </header>

      <h2 className="integrations-band">Cérebro (IA)</h2>
      <div className="integration-grid">
        <article className="integration-card">
          <header>
            <span className="integration-kind">IA</span>
            <h2>Ollama</h2>
          </header>
          <p>
            {status.ollamaAvailable
              ? 'Detectado — 3º na cascata (BYOK → cota grátis → Ollama).'
              : 'Não detectado. Instale/abra o Ollama para fallback local.'}
          </p>
          <label className="field">
            <span>Host</span>
            <input
              value={ollamaHost}
              onChange={(e) => setOllamaHost(e.target.value)}
              placeholder="http://127.0.0.1:11434"
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>Modelo</span>
            <input
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
              placeholder="llama3.2"
              autoComplete="off"
            />
          </label>
          <div className="integration-actions">
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={() => void probeOllama()}
            >
              Verificar de novo
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={() => void savePrefs()}
            >
              Salvar
            </button>
          </div>
          <footer>
            {ollamaStatus === 'ok' ? (
              <span className="badge accent">conectado</span>
            ) : (
              <span className="badge muted">configurar</span>
            )}
          </footer>
        </article>

        <article className="integration-card">
          <header>
            <span className="integration-kind">IA</span>
            <h2>OpenRouter</h2>
          </header>
          <p>
            {settings?.openRouterKeySource === 'env'
              ? 'Chave via ambiente (prioridade). Cascata: modelo sem :free = BYOK; :free = cota.'
              : settings?.openRouterKeyConfigured
                ? status.preferredTier === 'byok'
                  ? 'Chave no cofre — cascata começa em BYOK (modelo pago).'
                  : 'Chave no cofre — cascata começa na cota grátis (:free).'
                : settings?.encryptionAvailable === false
                  ? 'Criptografia do SO indisponível — use OPENROUTER_API_KEY no ambiente.'
                  : '1º–2º da cascata. Cole a chave aqui (ou env). Modelo pago = BYOK na frente.'}
          </p>
          <label className="field">
            <span>Modelo</span>
            <input
              value={openRouterModel}
              onChange={(e) => setOpenRouterModel(e.target.value)}
              placeholder="meta-llama/llama-3.2-3b-instruct:free"
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>API key</span>
            <input
              type="password"
              value={apiKeyDraft}
              onChange={(e) => setApiKeyDraft(e.target.value)}
              placeholder={
                settings?.openRouterKeyConfigured ? '•••••••• (nova chave)' : 'sk-or-…'
              }
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="integration-actions">
            <button
              type="button"
              className="btn primary"
              disabled={busy || apiKeyDraft.trim().length < 8}
              onClick={() => void saveOpenRouterKey()}
            >
              Salvar chave
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={busy || settings?.openRouterKeySource === 'env'}
              onClick={() => void clearOpenRouterKey()}
            >
              Remover do cofre
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={() => void savePrefs()}
            >
              Salvar modelo
            </button>
          </div>
          <footer>
            {openRouterStatus === 'ok' ? (
              <span className="badge accent">conectado</span>
            ) : (
              <span className="badge muted">configurar</span>
            )}
          </footer>
        </article>
      </div>

      <h2 className="integrations-band">Apps</h2>
      <div className="integration-grid">
        <article className="integration-card">
          <header>
            <span className="integration-kind">App</span>
            <h2>Spotify</h2>
          </header>
          <p>
            {!status.spotifyClientConfigured
              ? 'Defina ELIO_SPOTIFY_CLIENT_ID, redirect http://127.0.0.1:47821/callback, reinicie. Play remoto exige Premium.'
              : status.spotifyConnected
                ? 'Conta conectada (tokens cifrados neste PC).'
                : 'Client ID ok. Conecte com OAuth PKCE.'}
          </p>
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
          <footer>
            {status.spotifyConnected ? (
              <span className="badge accent">conectado</span>
            ) : (
              <span className="badge muted">configurar</span>
            )}
          </footer>
        </article>

        <article className="integration-card">
          <header>
            <span className="integration-kind">App</span>
            <h2>Clima (Open-Meteo)</h2>
          </header>
          <p>
            Sem chave. Preferência de cidade (opcional) — senão usa localização do PC / IP.
          </p>
          <label className="field">
            <span>Cidade preferida</span>
            <input
              value={weatherCity}
              onChange={(e) => setWeatherCity(e.target.value)}
              placeholder="ex.: Campinas"
              autoComplete="off"
            />
          </label>
          <div className="integration-actions">
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={() => void savePrefs()}
            >
              Salvar cidade
            </button>
          </div>
          <footer>
            <span className="badge accent">ok</span>
          </footer>
        </article>

        <article className="integration-card">
          <header>
            <span className="integration-kind">App</span>
            <h2>Fala do Elio (TTS)</h2>
          </header>
          <p>
            {tts?.hint ??
              'O Elio pode falar respostas em pt-BR (vozes do Windows ou edge-tts). Desligado por padrão.'}
          </p>
          <div className="integration-actions">
            <button
              type="button"
              className={tts?.enabled ? 'btn ghost' : 'btn primary'}
              disabled={ttsBusy || !tts}
              onClick={() => void toggleTts()}
            >
              {tts?.enabled ? 'Desligar TTS' : 'Ativar TTS'}
            </button>
            <label className="integration-select">
              Provedor
              <select
                value={tts?.provider ?? 'auto'}
                disabled={ttsBusy || !tts}
                onChange={(e) => void setTtsProvider(e.target.value as TtsPreference)}
              >
                <option value="auto">auto (Windows → edge)</option>
                <option value="system">system (SAPI / offline)</option>
                <option value="edge">edge-tts (rede)</option>
              </select>
            </label>
            {ttsSpeaking ? (
              <button
                type="button"
                className="btn ghost"
                onClick={() => void ttsController.stop()}
              >
                Parar fala
              </button>
            ) : null}
          </div>
          <footer>
            {tts?.enabled ? (
              <span className="badge accent">ligado</span>
            ) : (
              <span className="badge muted">desligado</span>
            )}
          </footer>
        </article>
      </div>

      <h2 className="integrations-band quiet">Em breve</h2>
      <ul className="soon-list">
        <li>
          <span>ChatGPT / Gemini (direto)</span>
          <span className="badge muted">em breve</span>
        </li>
        <li>
          <span>Slack</span>
          <span className="badge muted">em breve</span>
        </li>
        <li>
          <span>Jira</span>
          <span className="badge muted">em breve</span>
        </li>
      </ul>

      {message ? (
        <p className="integration-msg" role="status">
          {message}
        </p>
      ) : null}
    </section>
  )
}
