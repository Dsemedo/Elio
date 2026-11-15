import { useEffect, useRef, useState } from 'react'
import {
  AudioLines,
  Loader2,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  MoreHorizontal,
  WifiOff,
} from 'lucide-react'
import type { ChatStatus, ShellState, SttPreference } from '@shared/ipc'
import { detectChatToolIntent } from '@shared/chatIntent'
import {
  extractWindowsSpeechErrorCode,
  resolveSttBackend,
  shouldFallbackToWhisper,
  windowsSpeechUserMessage,
} from '@shared/sttPolicy'
import {
  isMicMissingMessage,
  micPermissionMessage,
  probeMicPresence,
  startMicRecording,
  type MicRecorder,
} from '../lib/recordWav'
import { ensureAppLocation } from '../lib/geolocation'
import {
  isWindowsSpeechAvailable,
  startWindowsSpeech,
  type WindowsSpeechSession,
} from '../lib/windowsSpeech'

export type BarUiState =
  'idle' | 'listening' | 'transcribing' | 'thinking' | 'error' | 'offline' | 'executing'

type VoicePhase = 'idle' | 'preparing' | 'recording' | 'transcribing'

type ActiveCapture =
  | {
      kind: 'windows-speech'
      session: WindowsSpeechSession
      /** WAV paralelo para fallback Whisper se o Speech falhar/vazio. */
      recorder: MicRecorder | null
    }
  | { kind: 'whisper'; recorder: MicRecorder }

const STATE_LABEL: Record<BarUiState, string> = {
  idle: '',
  listening: 'Ouvindo…',
  transcribing: 'Transcrevendo…',
  thinking: 'Pensando…',
  executing: 'Abrindo…',
  error: 'Erro',
  offline: 'Sem provedor',
}

/**
 * Floating Bar — DS v1.1 §3 + UX Douglas (voz primeiro, sem chrome duplo).
 * Erros ficam DENTRO da cápsula; overlay só para o menu (sem painel fantasma).
 */
export function FloatingBar(): React.JSX.Element {
  const [shell, setShell] = useState<ShellState | null>(null)
  const [status, setStatus] = useState<ChatStatus | null>(null)
  const [draft, setDraft] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [barState, setBarState] = useState<BarUiState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [inputActive, setInputActive] = useState(false)
  const [voicePhase, setVoicePhase] = useState<VoicePhase>('idle')
  const [lastReply, setLastReply] = useState<string | null>(null)
  const [statusLine, setStatusLine] = useState<string | null>(null)
  const [sttPreference, setSttPreference] = useState<SttPreference>('auto')
  const [platform, setPlatform] = useState<string>('win32')
  const inputRef = useRef<HTMLInputElement>(null)
  const captureRef = useRef<ActiveCapture | null>(null)
  const recordingActiveRef = useRef(false)
  const recordStartedAt = useRef(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const micProbeBusy = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function boot(): Promise<void> {
      try {
        const [shellState, chatStatus, list, voice, appInfo] = await Promise.all([
          window.elio.getShellState(),
          window.elio.getChatStatus(),
          window.elio.listConversations(),
          window.elio.getVoiceStatus(),
          window.elio.getAppInfo(),
        ])
        if (cancelled) return
        setShell(shellState)
        setStatus(chatStatus)
        setSttPreference(voice.sttPreference)
        setPlatform(voice.platform || appInfo.platform)
        if (list[0]) {
          setConversationId(list[0].id)
        } else {
          const created = await window.elio.createConversation()
          if (!cancelled) setConversationId(created.id)
        }
        if (chatStatus.preferredProvider === 'none') {
          setBarState('offline')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Falha ao iniciar a barra')
          setBarState('error')
        }
      }
    }
    void boot()
    const unsubShell = window.elio.onShellState((s) => setShell(s))
    const unsubChat = window.elio.onChatUpdated((event) => {
      if (cancelled) return
      if (event.reason === 'deleted') {
        setConversationId((current) =>
          current === event.conversationId ? null : current,
        )
        return
      }
      if (event.reason === 'created') {
        setConversationId((current) => current ?? event.conversationId)
        return
      }
      if (event.reason === 'updated' && event.conversation) {
        setConversationId((current) => {
          // Outra superfície falando na mesma thread (ou ainda sem id): espelha resposta.
          if (current && current !== event.conversationId) return current
          const msgs = event.conversation?.messages ?? []
          const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant')
          if (lastAssistant?.content.trim()) {
            setLastReply(lastAssistant.content.trim())
          }
          return current ?? event.conversationId
        })
      }
    })
    return () => {
      cancelled = true
      unsubShell()
      unsubChat()
      const capture = captureRef.current
      if (capture?.kind === 'windows-speech') {
        capture.session.cancel()
        capture.recorder?.cancel()
      } else if (capture?.kind === 'whisper') {
        capture.recorder.cancel()
      }
      captureRef.current = null
      void window.elio.setBarOverlay(false)
    }
  }, [])

  useEffect(() => {
    const onDoc = (event: MouseEvent): void => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // Overlay só para o menu — erros NÃO expandem a janela (evita retângulo fantasma).
  useEffect(() => {
    void window.elio.setBarOverlay(menuOpen)
    return () => {
      if (menuOpen) void window.elio.setBarOverlay(false)
    }
  }, [menuOpen])

  /**
   * Rechecagem silenciosa de mic no foco da janela / devicechange.
   * Sem alterar layout se o resultado for o mesmo; só limpa erro de mic
   * quando a lista volta a mostrar um input (mau contato resolvido).
   */
  useEffect(() => {
    const recheck = async (): Promise<void> => {
      if (micProbeBusy.current) return
      if (recordingActiveRef.current) return
      micProbeBusy.current = true
      try {
        const presence = await probeMicPresence()
        setError((current) => {
          if (!current || !isMicMissingMessage(current)) return current
          if (presence.listed) {
            // Device voltou à lista — libera o estado de erro sem thrash visual extra.
            setBarState((s) => (s === 'error' ? 'idle' : s))
            return null
          }
          // Continua ausente: mantém a mensagem (pode ser mau contato real).
          return current
        })
      } finally {
        micProbeBusy.current = false
      }
    }

    const onFocus = (): void => {
      void recheck()
    }
    const onDeviceChange = (): void => {
      void recheck()
    }

    window.addEventListener('focus', onFocus)
    navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange)
    return () => {
      window.removeEventListener('focus', onFocus)
      navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange)
    }
  }, [])

  const panelOpen = shell?.panelOpen ?? false
  const offline = status?.preferredProvider === 'none'

  const resolvedState = ((): BarUiState => {
    if (
      barState === 'listening' ||
      barState === 'transcribing' ||
      barState === 'thinking' ||
      barState === 'executing'
    ) {
      return barState
    }
    if (barState === 'error' && error) return 'error'
    if (offline) return 'offline'
    return 'idle'
  })()

  const ensureConversation = async (): Promise<string> => {
    if (conversationId) return conversationId
    const created = await window.elio.createConversation()
    setConversationId(created.id)
    return created.id
  }

  const sendContent = async (raw: string): Promise<void> => {
    const content = raw.trim()
    if (!content) return
    setError(null)
    setLastReply(null)
    setStatusLine(null)
    setMenuOpen(false)
    if (detectChatToolIntent(content).needsWeather) {
      try {
        await ensureAppLocation()
      } catch {
        /* clima cai no fallback IP/cidade no main */
      }
    }
    const looksLikeOpen = /^\s*(?:por\s+favor\s+|pf\s+|pode\s+)?(?:abre|abrir|abra|confirma\s+abrir)\b/i.test(
      content,
    )
    const looksLikeSpotify =
      /\bspotify\b/i.test(content) &&
      /\b(tocar?|toque|play|reproduz|m[uú]sica|conectar|conecte|desconectar|desconecte)\b/i.test(
        content,
      )
    const executing = looksLikeOpen || looksLikeSpotify
    setBarState(executing ? 'executing' : 'thinking')
    if (looksLikeSpotify) {
      setStatusLine(
        /\b(conectar|conecte)\b/i.test(content)
          ? 'Conectando Spotify…'
          : 'Abrindo Spotify…',
      )
    } else if (looksLikeOpen) {
      setStatusLine('Abrindo…')
    }
    setDraft('')
    setInputActive(false)
    try {
      const id = await ensureConversation()
      const result = await window.elio.sendMessage({ conversationId: id, content })
      const nextStatus = await window.elio.getChatStatus()
      setStatus(nextStatus)
      const replyText = result.reply.content.trim()
      setLastReply(replyText || '(sem texto na resposta)')
      setStatusLine(null)
      setBarState(nextStatus.preferredProvider === 'none' ? 'offline' : 'idle')
    } catch (err) {
      setStatusLine(null)
      setError(err instanceof Error ? err.message : 'Não foi possível responder')
      setBarState('error')
      setDraft(content)
      setInputActive(true)
    }
  }

  const send = async (): Promise<void> => {
    if (
      resolvedState === 'thinking' ||
      resolvedState === 'listening' ||
      resolvedState === 'executing'
    ) {
      return
    }
    await sendContent(draft)
  }

  const startWhisperCapture = async (): Promise<void> => {
    setVoicePhase('preparing')
    const voice = await window.elio.ensureVoice()
    setSttPreference(voice.sttPreference)
    setPlatform(voice.platform)
    if (!voice.ready) {
      setError(voice.hint || 'Voz indisponível')
      setBarState('error')
      setVoicePhase('idle')
      return
    }
    const recorder = await startMicRecording()
    captureRef.current = { kind: 'whisper', recorder }
    recordingActiveRef.current = true
    recordStartedAt.current = Date.now()
    setVoicePhase('recording')
    setBarState('listening')
  }

  const beginTalk = async (): Promise<void> => {
    if (
      resolvedState === 'thinking' ||
      resolvedState === 'executing' ||
      recordingActiveRef.current
    ) {
      return
    }
    setError(null)
    setLastReply(null)
    setStatusLine(null)
    setMenuOpen(false)
    setInputActive(false)
    setVoicePhase('preparing')
    try {
      await probeMicPresence()
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
            /* Speech sozinho ainda funciona; fallback Whisper fica indisponível neste PTT */
          }
          captureRef.current = { kind: 'windows-speech', session, recorder }
          recordingActiveRef.current = true
          recordStartedAt.current = Date.now()
          setVoicePhase('recording')
          setBarState('listening')
          return
        } catch (err) {
          // Indisponível / erro no start (incl. not-allowed) → Whisper.
          const code = extractWindowsSpeechErrorCode(
            err instanceof Error ? err.message : String(err),
          )
          if (!shouldFallbackToWhisper(code)) {
            setError(await micPermissionMessage(err).catch(() => windowsSpeechUserMessage(err)))
            setBarState('error')
            setVoicePhase('idle')
            return
          }
          setStatusLine('Usando Whisper…')
        }
      }

      await startWhisperCapture()
    } catch (err) {
      recordingActiveRef.current = false
      captureRef.current = null
      setError(await micPermissionMessage(err))
      setBarState('error')
      setVoicePhase('idle')
    }
  }

  const transcribeWithWhisper = async (recorder: MicRecorder): Promise<string> => {
    const voice = await window.elio.ensureVoice()
    if (!voice.ready) {
      throw new Error(voice.hint || 'Whisper indisponível')
    }
    const audioBase64 = await recorder.stop()
    const { text } = await window.elio.transcribeVoice({ audioBase64 })
    return text.trim()
  }

  const endTalk = async (): Promise<void> => {
    const capture = captureRef.current
    // Ref (não state): evita race do pointerUp antes do React aplicar 'recording'.
    if (!capture || !recordingActiveRef.current) return
    captureRef.current = null
    recordingActiveRef.current = false
    setVoicePhase('transcribing')
    setBarState('transcribing')
    try {
      if (Date.now() - recordStartedAt.current < 400) {
        if (capture.kind === 'windows-speech') {
          capture.session.cancel()
          capture.recorder?.cancel()
        } else {
          capture.recorder.cancel()
        }
        setStatusLine(null)
        setError('Áudio muito curto — segure e fale um pouco mais.')
        setBarState('error')
        setVoicePhase('idle')
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
          setStatusLine('Usando Whisper…')
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
          setStatusLine(null)
          setBarState('error')
          setVoicePhase('idle')
          return
        }
      } else {
        trimmed = await transcribeWithWhisper(capture.recorder)
      }

      if (!trimmed) {
        setStatusLine(null)
        setError('Não deu para entender — tente falar de novo.')
        setBarState('error')
        setVoicePhase('idle')
        return
      }

      // Auto-envio imediato (sem gate de confirmar/editar).
      setStatusLine(null)
      setVoicePhase('idle')
      await sendContent(trimmed)
    } catch (err) {
      setStatusLine(null)
      setError(err instanceof Error ? err.message : 'Falha na transcrição')
      setBarState('error')
      setVoicePhase('idle')
    }
  }

  const busy =
    resolvedState === 'listening' ||
    resolvedState === 'transcribing' ||
    resolvedState === 'thinking' ||
    resolvedState === 'executing'

  const showErrorInline = resolvedState === 'error' && !!error

  const showTextField = busy || showErrorInline
    ? false
    : inputActive || draft.trim().length > 0

  const showLastReply =
    !busy && !showTextField && !showErrorInline && !!lastReply && resolvedState === 'idle'

  const showStatusLine =
    !busy && !showTextField && !showErrorInline && !showLastReply && !!statusLine

  const activateInput = (): void => {
    if (busy) return
    setLastReply(null)
    setStatusLine(null)
    if (showErrorInline) {
      setError(null)
      setBarState(offline ? 'offline' : 'idle')
    }
    setInputActive(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const micMissing = isMicMissingMessage(error)
  const usingWindowsSpeech =
    resolveSttBackend({
      platform,
      speechRecognitionAvailable: isWindowsSpeechAvailable(),
      preference: sttPreference,
    }) === 'windows-speech'

  return (
    <div className="fb-root">
      <div
        className={`fb-shell state-${resolvedState}`}
        role="toolbar"
        aria-label="Elio Floating Bar"
        onMouseDown={(e) => {
          // Clique na barra foca o input (DS §3.5) — sem roubar se já está em controle.
          const target = e.target as HTMLElement
          if (target.closest('button, input, [role="menu"]')) return
          activateInput()
        }}
      >
        <div className="fb-drag" aria-hidden />

        <div className="fb-logo" title="Elio">
          <span className="fb-logo-mark" aria-hidden />
          <span className="fb-logo-text">Elio</span>
        </div>

        <div className="fb-input-wrap">
          {busy ? (
            <div
              className={
                resolvedState === 'thinking' || resolvedState === 'executing'
                  ? 'fb-state-inline thinking'
                  : 'fb-state-inline'
              }
              aria-live="polite"
            >
              {resolvedState === 'listening' ? (
                <AudioLines size={15} className="fb-wave" aria-hidden />
              ) : (
                <Loader2 size={15} className="fb-spin" aria-hidden />
              )}
              <span>
                {statusLine &&
                (resolvedState === 'executing' || resolvedState === 'transcribing')
                  ? statusLine
                  : STATE_LABEL[resolvedState]}
              </span>
            </div>
          ) : showErrorInline ? (
            <div className="fb-error-inline" role="alert" title={error ?? undefined}>
              <span className="fb-error-inline-text">{error}</span>
            </div>
          ) : showTextField ? (
            <input
              ref={inputRef}
              className="fb-input"
              value={draft}
              placeholder=""
              aria-label="Mensagem para o Elio"
              onChange={(e) => {
                setDraft(e.target.value)
                if (barState === 'error') setBarState(offline ? 'offline' : 'idle')
              }}
              onBlur={() => {
                if (!draft.trim()) setInputActive(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void send()
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setDraft('')
                  setInputActive(false)
                  setStatusLine(null)
                  inputRef.current?.blur()
                }
              }}
            />
          ) : showLastReply ? (
            <button
              type="button"
              className="fb-reply"
              title={lastReply ?? undefined}
              aria-label="Resposta do Elio — clique para abrir o Command Center"
              onClick={() => void window.elio.openPanel()}
            >
              <span className="fb-reply-label">Elio</span>
              <span className="fb-reply-text">{lastReply}</span>
            </button>
          ) : showStatusLine ? (
            <div className="fb-status-inline" aria-live="polite">
              <span className="fb-status-inline-text">{statusLine}</span>
            </div>
          ) : (
            <button
              type="button"
              className="fb-voice-idle"
              onClick={activateInput}
              aria-label="Ativar por voz com o microfone, ou clique para digitar"
            >
              <span className="fb-voice-idle-main">Segure o mic</span>
              <span className="fb-voice-idle-sub">Palavra de ativação · em breve</span>
            </button>
          )}
        </div>

        <div className="fb-actions">
          {resolvedState === 'offline' ? (
            <span className="fb-chip offline" title={status?.hint}>
              <WifiOff size={14} aria-hidden />
              <span className="fb-chip-label">offline</span>
            </span>
          ) : null}

          {showErrorInline && !micMissing ? (
            <span className="fb-chip error" title={error ?? undefined} aria-label={error ?? 'Erro'}>
              !
            </span>
          ) : null}

          <button
            type="button"
            className={
              resolvedState === 'listening'
                ? 'fb-icon-btn mic active'
                : micMissing
                  ? 'fb-icon-btn mic mic-missing'
                  : 'fb-icon-btn mic'
            }
            title={
              resolvedState === 'listening'
                ? 'Solte para transcrever'
                : micMissing
                  ? 'Mic ausente ou sem sinal — segure para tentar de novo'
                  : usingWindowsSpeech
                    ? 'Segure para falar (Windows Speech · envia sozinho)'
                    : 'Segure para falar (Whisper · envia sozinho)'
            }
            aria-label="Voz"
            aria-pressed={resolvedState === 'listening'}
            disabled={
              resolvedState === 'thinking' ||
              resolvedState === 'executing' ||
              voicePhase === 'transcribing'
            }
            onPointerDown={(e) => {
              e.preventDefault()
              // Mantém o PTT mesmo se o cursor sair do botão (senão corta cedo).
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
              setStatusLine(null)
              setVoicePhase('idle')
              setBarState(offline ? 'offline' : 'idle')
            }}
          >
            {micMissing ? <MicOff size={16} /> : <Mic size={16} />}
          </button>

          <button
            type="button"
            className={panelOpen ? 'fb-icon-btn active' : 'fb-icon-btn'}
            title={panelOpen ? 'Recolher Command Center' : 'Expandir Command Center'}
            aria-label={panelOpen ? 'Recolher' : 'Expandir'}
            aria-expanded={panelOpen}
            onClick={() => void window.elio.togglePanel()}
          >
            {panelOpen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          <div className="fb-menu" ref={menuRef}>
            <button
              type="button"
              className="fb-icon-btn"
              title="Mais opções"
              aria-label="Menu"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen ? (
              <div className="fb-menu-pop" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    void window.elio.openPanel()
                  }}
                >
                  Abrir Command Center
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={draft.trim().length === 0 || resolvedState === 'thinking'}
                  onClick={() => {
                    setMenuOpen(false)
                    void send()
                  }}
                >
                  Enviar mensagem
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    void (async () => {
                      const created = await window.elio.createConversation()
                      setConversationId(created.id)
                      setDraft('')
                      setInputActive(false)
                      setError(null)
                      setBarState(offline ? 'offline' : 'idle')
                    })()
                  }}
                >
                  Nova conversa
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled
                  title="Em breve"
                  aria-disabled="true"
                >
                  Palavra de ativação · em breve
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    void window.elio.hideShell()
                  }}
                >
                  Ocultar (bandeja)
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
