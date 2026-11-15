import { useEffect, useRef, useState } from 'react'
import type {
  ChatStatus,
  Conversation,
  ConversationSummary,
  SttPreference,
  VoiceProgress,
  VoiceStatus,
} from '@shared/ipc'
import { isNearBottom, shouldAutoScrollToBottom } from '@shared/chatScroll'
import { detectChatToolIntent } from '@shared/chatIntent'
import {
  extractWindowsSpeechErrorCode,
  resolveSttBackend,
  shouldFallbackToWhisper,
  windowsSpeechUserMessage,
} from '@shared/sttPolicy'
import {
  micPermissionMessage,
  startMicRecording,
  type MicRecorder,
} from '../lib/recordWav'
import { ensureAppLocation } from '../lib/geolocation'
import {
  isWindowsSpeechAvailable,
  startWindowsSpeech,
  type WindowsSpeechSession,
} from '../lib/windowsSpeech'

type Props = {
  status: ChatStatus
  summaries: ConversationSummary[]
  conversation: Conversation
  /** Lista de threads ao lado (padrão Command Center). */
  showSidebar?: boolean
  busyExternal?: boolean
  onConversationChange: (conversation: Conversation) => Promise<void>
  onSelect: (id: string) => Promise<void>
  onNew: () => Promise<void>
  onDelete: (id: string) => Promise<void>
  onRename?: (id: string, title: string) => Promise<void>
  onStatusRefresh: () => Promise<void>
}

type VoiceUiState = 'idle' | 'preparing' | 'recording' | 'transcribing' | 'thinking'

type ActiveCapture =
  | {
      kind: 'windows-speech'
      session: WindowsSpeechSession
      recorder: MicRecorder | null
    }
  | { kind: 'whisper'; recorder: MicRecorder }

export function ChatView({
  status,
  summaries,
  conversation,
  showSidebar = true,
  onConversationChange,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onStatusRefresh,
}: Props): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus | null>(null)
  const [voiceUi, setVoiceUi] = useState<VoiceUiState>('idle')
  const [voiceProgress, setVoiceProgress] = useState<VoiceProgress | null>(null)
  const [whisperFallbackHint, setWhisperFallbackHint] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const captureRef = useRef<ActiveCapture | null>(null)
  const recordingActiveRef = useRef(false)
  const recordStartedAt = useRef(0)

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
      const capture = captureRef.current
      if (capture?.kind === 'windows-speech') {
        capture.session.cancel()
        capture.recorder?.cancel()
      } else if (capture?.kind === 'whisper') {
        capture.recorder.cancel()
      }
      captureRef.current = null
    }
  }, [])

  const sttPreference: SttPreference = voiceStatus?.sttPreference ?? 'auto'
  const platform = voiceStatus?.platform ?? 'win32'
  const usingWindowsSpeech =
    resolveSttBackend({
      platform,
      speechRecognitionAvailable: isWindowsSpeechAvailable(),
      preference: sttPreference,
    }) === 'windows-speech'

  const sendContent = async (raw: string): Promise<void> => {
    const content = raw.trim()
    if (!content || busy) return

    stickToBottomRef.current = true
    setBusy(true)
    setVoiceUi('thinking')
    setWhisperFallbackHint(false)
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

  const startWhisperCapture = async (): Promise<void> => {
    const ready = await ensureVoiceReady()
    if (!ready) return
    const recorder = await startMicRecording()
    captureRef.current = { kind: 'whisper', recorder }
    recordingActiveRef.current = true
    recordStartedAt.current = Date.now()
    setVoiceUi('recording')
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
    setWhisperFallbackHint(false)
    setVoiceUi('preparing')

    try {
      const backend = resolveSttBackend({
        platform,
        speechRecognitionAvailable: isWindowsSpeechAvailable(),
        preference: sttPreference,
      })

      if (backend === 'windows-speech') {
        try {
          const session = await startWindowsSpeech({ lang: 'pt-BR' })
          let recorder: MicRecorder | null = null
          try {
            recorder = await startMicRecording()
          } catch {
            /* ok — fallback Whisper indisponível neste PTT */
          }
          captureRef.current = { kind: 'windows-speech', session, recorder }
          recordingActiveRef.current = true
          recordStartedAt.current = Date.now()
          setVoiceUi('recording')
          return
        } catch (err) {
          const code = extractWindowsSpeechErrorCode(
            err instanceof Error ? err.message : String(err),
          )
          if (!shouldFallbackToWhisper(code)) {
            setError(await micPermissionMessage(err).catch(() => windowsSpeechUserMessage(err)))
            setVoiceUi('idle')
            return
          }
          setWhisperFallbackHint(true)
        }
      }

      await startWhisperCapture()
    } catch (err) {
      recordingActiveRef.current = false
      captureRef.current = null
      setError(await micPermissionMessage(err))
      setVoiceUi('idle')
    }
  }

  const transcribeWithWhisper = async (recorder: MicRecorder): Promise<string> => {
    const ready = await ensureVoiceReady()
    if (!ready) throw new Error('Whisper indisponível')
    const audioBase64 = await recorder.stop()
    const { text } = await window.elio.transcribeVoice({ audioBase64 })
    setVoiceStatus(await window.elio.getVoiceStatus())
    setVoiceProgress(null)
    return text.trim()
  }

  const endTalk = async (): Promise<void> => {
    const capture = captureRef.current
    if (!capture || !recordingActiveRef.current) return
    captureRef.current = null
    recordingActiveRef.current = false
    setVoiceUi('transcribing')

    try {
      const elapsed = Date.now() - recordStartedAt.current
      if (elapsed < 400) {
        if (capture.kind === 'windows-speech') {
          capture.session.cancel()
          capture.recorder?.cancel()
        } else {
          capture.recorder.cancel()
        }
        setError('Áudio muito curto — segure o botão e fale um pouco mais.')
        setVoiceUi('idle')
        return
      }

      let trimmed = ''

      if (capture.kind === 'windows-speech') {
        let speechText = ''
        let speechFailed = false
        let speechErrorCode: string | null = null
        try {
          speechText = (await capture.session.stop()).trim()
        } catch (err) {
          speechFailed = true
          const msg = err instanceof Error ? err.message : ''
          speechErrorCode = extractWindowsSpeechErrorCode(msg)
        }

        if (speechText) {
          capture.recorder?.cancel()
          trimmed = speechText
        } else if (
          capture.recorder &&
          (!speechFailed || shouldFallbackToWhisper(speechErrorCode))
        ) {
          setWhisperFallbackHint(true)
          trimmed = await transcribeWithWhisper(capture.recorder)
        } else {
          capture.recorder?.cancel()
          if (speechFailed) {
            setError(
              windowsSpeechUserMessage(
                new Error(`WINDOWS_SPEECH_ERROR:${speechErrorCode ?? 'unknown'}`),
              ),
            )
          } else {
            setError('Não deu para entender — tente falar de novo.')
          }
          setVoiceUi('idle')
          setVoiceProgress(null)
          setWhisperFallbackHint(false)
          return
        }
      } else {
        trimmed = await transcribeWithWhisper(capture.recorder)
      }

      if (!trimmed) {
        setError('Não deu para entender — tente falar de novo.')
        setVoiceUi('idle')
        setVoiceProgress(null)
        return
      }

      // Auto-envio imediato (sem gate de confirmar/editar).
      await sendContent(trimmed)
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
        ? whisperFallbackHint
          ? 'Usando Whisper…'
          : 'Preparando voz…'
        : voiceUi === 'transcribing'
          ? whisperFallbackHint
            ? 'Usando Whisper…'
            : 'Transcrevendo…'
          : voiceUi === 'thinking'
            ? 'Pensando…'
            : usingWindowsSpeech
              ? 'Segure para falar (Windows Speech · envia sozinho)'
              : voiceStatus?.ready
                ? 'Segure para falar (Whisper · envia sozinho)'
                : 'Segure para falar (baixa Whisper na 1ª vez se precisar)'

  const providerLabel =
    status.preferredProvider === 'none'
      ? 'sem provedor'
      : status.preferredProvider === 'ollama'
        ? 'Ollama'
        : 'OpenRouter'
  const headerStatus = busy
    ? 'Pensando…'
    : voiceUi === 'recording'
      ? 'Ouvindo…'
      : voiceUi === 'transcribing' || voiceUi === 'preparing'
        ? 'Voz…'
        : providerLabel

  const confirmDelete = (id: string, title: string): void => {
    const ok = window.confirm(`Excluir a conversa “${title}”?`)
    if (!ok) return
    void onDelete(id)
  }

  return (
    <div className={showSidebar ? 'chat-app' : 'chat-app chat-app-solo'}>
      {showSidebar ? (
        <aside className="sidebar" aria-label="Conversas">
          <div className="sidebar-brand">
            <span className="sidebar-logo">Conversas</span>
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
                  onDoubleClick={() => {
                    if (!onRename) return
                    const next = window.prompt('Renomear conversa', item.title)
                    if (next?.trim()) void onRename(item.id, next.trim())
                  }}
                >
                  <span className="thread-title">{item.title}</span>
                  <span className="thread-meta">{item.messageCount} msgs</span>
                </button>
                <button
                  type="button"
                  className="thread-delete"
                  title="Excluir conversa"
                  onClick={() => confirmDelete(item.id, item.title)}
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
            <h1>{conversation.title}</h1>
            <p className="status-hint">{headerStatus}</p>
          </div>
          <div className="header-badges">
            <button type="button" className="btn ghost" onClick={() => void onNew()}>
              Nova
            </button>
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
              <p>Escreva ou fale. Posso ajudar com o dia a dia neste PC.</p>
              {!usingWindowsSpeech && !voiceStatus?.ready ? (
                <button
                  type="button"
                  className="btn ghost"
                  style={{ marginTop: '0.75rem' }}
                  disabled={voiceBusy || busy}
                  onClick={() => void prepareVoiceClick()}
                >
                  Preparar voz
                </button>
              ) : null}
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
              }}
              onKeyDown={onKeyDown}
              placeholder="Escreva ou segure o microfone… (envia sozinho após a fala)"
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
                  title="Baixa o Whisper para usar se o Windows Speech falhar (offline)"
                >
                  {usingWindowsSpeech ? 'Preparar fallback' : 'Preparar voz'}
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
                  const capture = captureRef.current
                  if (capture?.kind === 'windows-speech') {
                    capture.session.cancel()
                    capture.recorder?.cancel()
                  } else if (capture?.kind === 'whisper') {
                    capture.recorder.cancel()
                  }
                  captureRef.current = null
                  recordingActiveRef.current = false
                  setWhisperFallbackHint(false)
                  setVoiceUi('idle')
                }}
              >
                {voiceUi === 'recording'
                  ? 'Ouvindo…'
                  : voiceUi === 'transcribing'
                    ? whisperFallbackHint
                      ? 'Usando Whisper…'
                      : 'Transcrevendo…'
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
