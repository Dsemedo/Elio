import { useEffect, useRef, useState } from 'react'
import type {
  ChatStatus,
  Conversation,
  ConversationSummary,
  VoiceProgress,
  VoiceStatus,
} from '@shared/ipc'
import { isNearBottom, shouldAutoScrollToBottom } from '@shared/chatScroll'
import { detectChatToolIntent } from '@shared/chatIntent'
import {
  micPermissionMessage,
  startMicRecording,
  type MicRecorder,
} from '../lib/recordWav'
import { ensureAppLocation } from '../lib/geolocation'
import {
  armVoiceConfirmSend,
  type VoiceConfirmController,
} from '@shared/voiceConfirm'

type Props = {
  status: ChatStatus
  /** Versão do package.json — se não for a do PR de voz, ainda está no código antigo. */
  appVersion: string
  summaries: ConversationSummary[]
  conversation: Conversation
  /** Sidebar de threads; no painel shell o Histórico cobre isso. */
  showSidebar?: boolean
  onConversationChange: (conversation: Conversation) => Promise<void>
  onSelect: (id: string) => Promise<void>
  onNew: () => Promise<void>
  onDelete: (id: string) => Promise<void>
  onStatusRefresh: () => Promise<void>
}

type VoiceUiState = 'idle' | 'preparing' | 'recording' | 'transcribing' | 'thinking'

export function ChatView({
  status,
  appVersion,
  summaries,
  conversation,
  showSidebar = true,
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
  const [voiceConfirmHint, setVoiceConfirmHint] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recorderRef = useRef<MicRecorder | null>(null)
  const recordingActiveRef = useRef(false)
  const recordStartedAt = useRef(0)
  const draftRef = useRef('')
  const voiceConfirmRef = useRef<VoiceConfirmController | null>(null)

  draftRef.current = draft

  useEffect(() => {
    const el = messagesRef.current
    if (!el) return
    if (
      !shouldAutoScrollToBottom({
        wasNearBottom: stickToBottomRef.current,
        forceStick: busy,
      })
    ) {
      return
    }
    bottomRef.current?.scrollIntoView({ behavior: busy ? 'auto' : 'smooth' })
    stickToBottomRef.current = true
  }, [conversation.messages, busy, conversation.id])

  useEffect(() => {
    stickToBottomRef.current = true
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

  const cancelVoiceConfirm = (): void => {
    voiceConfirmRef.current?.cancel()
    voiceConfirmRef.current = null
    setVoiceConfirmHint(null)
  }

  const sendContent = async (raw: string): Promise<void> => {
    const content = raw.trim()
    if (!content || busy) return

    cancelVoiceConfirm()
    stickToBottomRef.current = true
    setBusy(true)
    setVoiceUi('thinking')
    setError(null)
    setDraft('')

    if (detectChatToolIntent(content).needsWeather) {
      try {
        await ensureAppLocation()
      } catch {
        /* main resolve IP/fallback */
      }
    }

    // Optimistic: mostra a mensagem do usuário enquanto “Pensando…”.
    const optimisticId = `local-${Date.now()}`
    await onConversationChange({
      ...conversation,
      updatedAt: new Date().toISOString(),
      messages: [
        ...conversation.messages,
        {
          id: optimisticId,
          role: 'user',
          content,
          createdAt: new Date().toISOString(),
        },
      ],
    })

    try {
      const result = await window.elio.sendMessage({
        conversationId: conversation.id,
        content,
      })
      setLastModel(`${result.provider} · ${result.model}`)
      stickToBottomRef.current = true
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
      setVoiceUi('idle')
      inputRef.current?.focus()
    }
  }

  const send = async (): Promise<void> => {
    cancelVoiceConfirm()
    await sendContent(draft)
  }

  const cancel = async (): Promise<void> => {
    await window.elio.cancelReply(conversation.id)
  }

  const onKeyDown = (event: {
    key: string
    shiftKey: boolean
    preventDefault: () => void
  }): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelVoiceConfirm()
      return
    }
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
    if (
      busy ||
      recordingActiveRef.current ||
      voiceUi === 'transcribing' ||
      voiceUi === 'thinking'
    ) {
      return
    }
    setError(null)

    const ready = await ensureVoiceReady()
    if (!ready) return

    try {
      const recorder = await startMicRecording()
      recorderRef.current = recorder
      recordingActiveRef.current = true
      recordStartedAt.current = Date.now()
      setVoiceUi('recording')
    } catch (err) {
      recordingActiveRef.current = false
      setError(await micPermissionMessage(err))
      setVoiceUi('idle')
    }
  }

  const endTalk = async (): Promise<void> => {
    const recorder = recorderRef.current
    if (!recorder || !recordingActiveRef.current) return
    recorderRef.current = null
    recordingActiveRef.current = false
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
      const trimmed = text.trim()
      if (!trimmed) {
        setError('Não deu para entender — tente falar de novo.')
        setVoiceUi('idle')
        setVoiceProgress(null)
        return
      }
      setVoiceStatus(await window.elio.getVoiceStatus())
      setVoiceProgress(null)
      const existing = draftRef.current.trim()
      const content = existing ? `${existing} ${trimmed}` : trimmed
      cancelVoiceConfirm()
      setDraft(content)
      setVoiceUi('idle')
      setVoiceConfirmHint('Confira o texto — envia sozinho em instantes (Enter agora, Esc cancela)')
      requestAnimationFrame(() => inputRef.current?.focus())
      voiceConfirmRef.current = armVoiceConfirmSend(() => {
        voiceConfirmRef.current = null
        setVoiceConfirmHint(null)
        const latest = draftRef.current.trim()
        if (latest) void sendContent(latest)
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na transcrição')
      setVoiceUi('idle')
      setVoiceProgress(null)
    }
  }

  const voiceBusy =
    voiceUi === 'preparing' ||
    voiceUi === 'transcribing' ||
    voiceUi === 'thinking'
  const micLabel =
    voiceUi === 'recording'
      ? 'Solte para transcrever'
      : voiceUi === 'preparing'
        ? 'Preparando voz…'
        : voiceUi === 'transcribing'
          ? 'Transcrevendo…'
          : voiceUi === 'thinking'
            ? 'Pensando…'
            : voiceStatus?.ready
              ? 'Segure para falar (confira o texto antes de enviar)'
              : 'Segure para falar (baixa Whisper na 1ª vez)'

  return (
    <div className={showSidebar ? 'chat-app' : 'chat-app chat-app-solo'}>
      {showSidebar ? (
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
      ) : null}

      <section className="chat-main">
        <header className="chat-header">
          <div>
            <h1>Conversar</h1>
            <p className="status-hint">{status.hint}</p>
            {voiceStatus ? (
              <p className="status-hint voice-hint">
                {voiceStatus.ready
                  ? `Voz pronta (Whisper ${voiceStatus.modelId} local).`
                  : voiceStatus.hint}
              </p>
            ) : null}
          </div>
          <div className="header-badges">
            {!showSidebar ? (
              <button type="button" className="btn ghost" onClick={() => void onNew()}>
                Nova
              </button>
            ) : null}
            <span className="badge" title="Versão do Elio">
              v{appVersion}
            </span>
            {lastModel ? (
              <span className="badge ai" title="Modelo de IA">
                {lastModel}
              </span>
            ) : null}
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

        <div
          className="messages"
          role="log"
          aria-live="polite"
          tabIndex={0}
          ref={messagesRef}
          onScroll={() => {
            const el = messagesRef.current
            if (!el) return
            stickToBottomRef.current = isNearBottom(
              el.scrollTop,
              el.clientHeight,
              el.scrollHeight,
            )
          }}
        >
          {conversation.messages.length === 0 && !busy ? (
            <div className="empty-state">
              <p className="empty-title">Olá — sou o Elio.</p>
              <p>
                Escreva ou use o microfone. Após a fala, confira o texto na caixa (envia
                sozinho em instantes). Pergunte a hora ou o tempo — uso o relógio local,
                Open-Meteo e a localização do PC (com permissão). Na primeira vez a voz
                baixa o Whisper (~466 MB, modelo small). O áudio fica só neste PC.
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

        <div className="chat-footer">
          {error ? (
            <div className="error-banner" role="alert">
              {error}
            </div>
          ) : null}

          {voiceConfirmHint ? (
            <div className="voice-hint" role="status">
              {voiceConfirmHint}
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
              onChange={(e) => {
                setDraft(e.target.value)
                if (voiceConfirmRef.current?.isArmed()) {
                  cancelVoiceConfirm()
                }
              }}
              onKeyDown={onKeyDown}
              placeholder="Escreva ou segure o microfone… (confira o texto antes de enviar)"
              rows={3}
              disabled={busy || voiceUi === 'recording' || voiceUi === 'transcribing'}
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
                className={voiceUi === 'recording' ? 'btn mic recording' : 'btn mic'}
                disabled={busy || voiceBusy}
                aria-pressed={voiceUi === 'recording'}
                title={micLabel}
                onPointerDown={(e) => {
                  e.preventDefault()
                  e.currentTarget.setPointerCapture(e.pointerId)
                  void beginTalk()
                }}
                onPointerUp={(e) => {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId)
                  }
                  void endTalk()
                }}
                onPointerCancel={() => {
                  recorderRef.current?.cancel()
                  recorderRef.current = null
                  recordingActiveRef.current = false
                  setVoiceUi('idle')
                }}
              >
                {voiceUi === 'recording'
                  ? 'Ouvindo…'
                  : voiceUi === 'transcribing'
                    ? 'Transcrevendo…'
                    : voiceUi === 'thinking'
                      ? 'Pensando…'
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
        </div>
      </section>
    </div>
  )
}
