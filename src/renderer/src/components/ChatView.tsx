import { useEffect, useRef, useState } from 'react'
import type {
  ChatStatus,
  Conversation,
  ConversationSummary,
  VoiceProgress,
  VoiceStatus,
} from '@shared/ipc'
import { micPermissionMessage, startMicRecording, type MicRecorder } from '../lib/recordWav'

type Props = {
  status: ChatStatus
  /** Versão do package.json — se não for a do PR de voz, ainda está no código antigo. */
  appVersion: string
  summaries: ConversationSummary[]
  conversation: Conversation
  onConversationChange: (conversation: Conversation) => Promise<void>
  onSelect: (id: string) => Promise<void>
  onNew: () => Promise<void>
  onDelete: (id: string) => Promise<void>
  onStatusRefresh: () => Promise<void>
}

type VoiceUiState = 'idle' | 'preparing' | 'recording' | 'transcribing'

export function ChatView({
  status,
  appVersion,
  summaries,
  conversation,
  onConversationChange,
  onSelect,
  onNew,
  onDelete,
  onStatusRefresh,
}: Props): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastModel, setLastModel] = useState<string | null>(null)
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus | null>(null)
  const [voiceUi, setVoiceUi] = useState<VoiceUiState>('idle')
  const [voiceProgress, setVoiceProgress] = useState<VoiceProgress | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recorderRef = useRef<MicRecorder | null>(null)
  const recordStartedAt = useRef(0)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation.messages, busy])

  useEffect(() => {
    inputRef.current?.focus()
  }, [conversation.id])

  useEffect(() => {
    let cancelled = false
    void window.elio.getVoiceStatus().then((s) => {
      if (!cancelled) setVoiceStatus(s)
    })
    const unsubscribe = window.elio.onVoiceProgress((p) => {
      setVoiceProgress(p)
    })
    return () => {
      cancelled = true
      unsubscribe()
      recorderRef.current?.cancel()
      recorderRef.current = null
    }
  }, [])

  const send = async (): Promise<void> => {
    const content = draft.trim()
    if (!content || busy) return

    setBusy(true)
    setError(null)
    setDraft('')

    try {
      const result = await window.elio.sendMessage({
        conversationId: conversation.id,
        content,
      })
      setLastModel(`${result.provider} · ${result.model}`)
      await onConversationChange(result.conversation)
      await onStatusRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível responder')
      try {
        const fresh = await window.elio.getConversation(conversation.id)
        await onConversationChange(fresh)
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  const cancel = async (): Promise<void> => {
    await window.elio.cancelReply(conversation.id)
  }

  const onKeyDown = (event: {
    key: string
    shiftKey: boolean
    preventDefault: () => void
  }): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send()
    }
  }

  const ensureVoiceReady = async (): Promise<boolean> => {
    if (voiceStatus?.ready) return true
    setVoiceUi('preparing')
    setError(null)
    try {
      const next = await window.elio.ensureVoice()
      setVoiceStatus(next)
      setVoiceProgress(null)
      return next.ready
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao preparar a voz')
      setVoiceUi('idle')
      return false
    }
  }

  const prepareVoiceClick = async (): Promise<void> => {
    const ok = await ensureVoiceReady()
    if (ok) setVoiceUi('idle')
  }

  const beginTalk = async (): Promise<void> => {
    if (busy || voiceUi === 'recording' || voiceUi === 'transcribing') return
    setError(null)

    const ready = await ensureVoiceReady()
    if (!ready) return

    try {
      const recorder = await startMicRecording()
      recorderRef.current = recorder
      recordStartedAt.current = Date.now()
      setVoiceUi('recording')
    } catch (err) {
      setError(micPermissionMessage(err))
      setVoiceUi('idle')
    }
  }

  const endTalk = async (): Promise<void> => {
    const recorder = recorderRef.current
    if (!recorder || voiceUi !== 'recording') return
    recorderRef.current = null
    setVoiceUi('transcribing')

    try {
      const elapsed = Date.now() - recordStartedAt.current
      if (elapsed < 400) {
        recorder.cancel()
        setError('Áudio muito curto — segure o botão e fale um pouco mais.')
        setVoiceUi('idle')
        return
      }

      const audioBase64 = await recorder.stop()
      const { text } = await window.elio.transcribeVoice({ audioBase64 })
      setDraft((prev) => {
        const trimmed = prev.trim()
        return trimmed ? `${trimmed} ${text}` : text
      })
      setVoiceStatus(await window.elio.getVoiceStatus())
      inputRef.current?.focus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na transcrição')
    } finally {
      setVoiceUi('idle')
      setVoiceProgress(null)
    }
  }

  const voiceBusy = voiceUi === 'preparing' || voiceUi === 'transcribing'
  const micLabel =
    voiceUi === 'recording'
      ? 'Solte para transcrever'
      : voiceUi === 'preparing'
        ? 'Preparando voz…'
        : voiceUi === 'transcribing'
          ? 'Transcrevendo…'
          : voiceStatus?.ready
            ? 'Segure para falar'
            : 'Segure para falar (baixa Whisper na 1ª vez)'

  return (
    <div className="chat-app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-logo">Elio</span>
          <button type="button" className="btn ghost" onClick={() => void onNew()}>
            Nova
          </button>
        </div>
        <ul className="thread-list">
          {summaries.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={
                  item.id === conversation.id ? 'thread-item active' : 'thread-item'
                }
                onClick={() => void onSelect(item.id)}
              >
                <span className="thread-title">{item.title}</span>
                <span className="thread-meta">{item.messageCount} msgs</span>
              </button>
              <button
                type="button"
                className="thread-delete"
                title="Excluir conversa"
                onClick={() => void onDelete(item.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="chat-main">
        <header className="chat-header">
          <div>
            <h1>Conversar</h1>
            <p className="status-hint">{status.hint}</p>
            {voiceStatus ? (
              <p className="status-hint voice-hint">
                {voiceStatus.ready
                  ? 'Voz pronta (Whisper local).'
                  : voiceStatus.hint}
              </p>
            ) : null}
          </div>
          <div className="header-badges">
            <span className="badge" title="Versão do Elio">
              v{appVersion}
            </span>
            {lastModel ? <span className="badge">{lastModel}</span> : null}
            <span className="badge muted">
              {status.preferredProvider === 'none'
                ? 'sem provedor'
                : status.preferredProvider}
            </span>
            {voiceStatus?.ready ? (
              <span className="badge accent">voz ok</span>
            ) : (
              <span className="badge muted">voz pendente</span>
            )}
          </div>
        </header>

        <div className="messages" role="log" aria-live="polite">
          {conversation.messages.length === 0 && !busy ? (
            <div className="empty-state">
              <p className="empty-title">Olá — sou o Elio.</p>
              <p>
                Escreva ou use o microfone. Na primeira vez a voz baixa o Whisper
                (~80 MB, uma vez). O áudio fica só neste PC.
              </p>
            </div>
          ) : null}

          {conversation.messages.map((message) => (
            <article
              key={message.id}
              className={
                message.role === 'user' ? 'bubble bubble-user' : 'bubble bubble-assistant'
              }
            >
              <header className="bubble-meta">
                {message.role === 'user' ? 'Você' : 'Elio'}
                {message.model ? ` · ${message.model}` : ''}
              </header>
              <p className="bubble-body">{message.content}</p>
            </article>
          ))}

          {busy ? (
            <article className="bubble bubble-assistant">
              <header className="bubble-meta">Elio</header>
              <p className="bubble-body thinking">Pensando…</p>
            </article>
          ) : null}
          <div ref={bottomRef} />
        </div>

        {error ? (
          <div className="error-banner" role="alert">
            {error}
          </div>
        ) : null}

        {voiceProgress && voiceUi === 'preparing' ? (
          <div className="voice-progress" role="status">
            <div className="voice-progress-bar">
              <div
                className="voice-progress-fill"
                style={{ width: `${voiceProgress.percent}%` }}
              />
            </div>
            <span>{voiceProgress.message}</span>
          </div>
        ) : null}

        <footer className="composer">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Escreva ou segure o microfone… (Enter envia)"
            rows={3}
            disabled={busy || voiceUi === 'recording'}
          />
          <div className="composer-actions">
            {!voiceStatus?.ready ? (
              <button
                type="button"
                className="btn ghost"
                disabled={voiceBusy || busy}
                onClick={() => void prepareVoiceClick()}
              >
                Preparar voz
              </button>
            ) : null}
            <button
              type="button"
              className={
                voiceUi === 'recording' ? 'btn mic recording' : 'btn mic'
              }
              disabled={busy || voiceBusy}
              aria-pressed={voiceUi === 'recording'}
              title={micLabel}
              onPointerDown={(e) => {
                e.preventDefault()
                void beginTalk()
              }}
              onPointerUp={() => void endTalk()}
              onPointerLeave={() => {
                if (voiceUi === 'recording') void endTalk()
              }}
              onPointerCancel={() => {
                recorderRef.current?.cancel()
                recorderRef.current = null
                setVoiceUi('idle')
              }}
            >
              {voiceUi === 'recording'
                ? 'Gravando…'
                : voiceUi === 'transcribing'
                  ? 'Transcrevendo…'
                  : 'Falar'}
            </button>
            {busy ? (
              <button type="button" className="btn ghost" onClick={() => void cancel()}>
                Cancelar
              </button>
            ) : null}
            <button
              type="button"
              className="btn primary"
              disabled={busy || draft.trim().length === 0 || voiceUi === 'recording'}
              onClick={() => void send()}
            >
              {busy ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}
