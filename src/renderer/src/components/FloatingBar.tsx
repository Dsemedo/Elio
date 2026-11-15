import { useEffect, useRef, useState } from 'react'
import {
  AudioLines,
  Loader2,
  Maximize2,
  Mic,
  Minimize2,
  MoreHorizontal,
  WifiOff,
} from 'lucide-react'
import type { ChatStatus, ShellState } from '@shared/ipc'
import {
  micPermissionMessage,
  startMicRecording,
  type MicRecorder,
} from '../lib/recordWav'

export type BarUiState =
  'idle' | 'listening' | 'transcribing' | 'thinking' | 'error' | 'offline'

type VoicePhase = 'idle' | 'preparing' | 'recording' | 'transcribing'

const STATE_LABEL: Record<BarUiState, string> = {
  idle: '',
  listening: 'Ouvindo…',
  transcribing: 'Transcrevendo…',
  thinking: 'Pensando…',
  error: 'Erro',
  offline: 'Sem provedor',
}

/**
 * Floating Bar — DS v1.1 §3 + UX Douglas (voz primeiro, sem chrome duplo).
 * Identidade: logo + mic PTT. Campo de texto sob demanda (sem placeholder).
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
  const inputRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MicRecorder | null>(null)
  const recordStartedAt = useRef(0)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    async function boot(): Promise<void> {
      try {
        const [shellState, chatStatus, list] = await Promise.all([
          window.elio.getShellState(),
          window.elio.getChatStatus(),
          window.elio.listConversations(),
        ])
        if (cancelled) return
        setShell(shellState)
        setStatus(chatStatus)
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
    const unsub = window.elio.onShellState((s) => setShell(s))
    return () => {
      cancelled = true
      unsub()
      recorderRef.current?.cancel()
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

  useEffect(() => {
    const needOverlay = menuOpen || (barState === 'error' && !!error)
    void window.elio.setBarOverlay(needOverlay)
    return () => {
      if (needOverlay) void window.elio.setBarOverlay(false)
    }
  }, [menuOpen, barState, error])

  const panelOpen = shell?.panelOpen ?? false
  const offline = status?.preferredProvider === 'none'

  const resolvedState = ((): BarUiState => {
    if (
      barState === 'listening' ||
      barState === 'transcribing' ||
      barState === 'thinking'
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
    setMenuOpen(false)
    setBarState('thinking')
    setDraft('')
    setInputActive(false)
    try {
      const id = await ensureConversation()
      await window.elio.sendMessage({ conversationId: id, content })
      const nextStatus = await window.elio.getChatStatus()
      setStatus(nextStatus)
      setBarState(nextStatus.preferredProvider === 'none' ? 'offline' : 'idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível responder')
      setBarState('error')
      setDraft(content)
      setInputActive(true)
    }
  }

  const send = async (): Promise<void> => {
    if (resolvedState === 'thinking' || resolvedState === 'listening') return
    await sendContent(draft)
  }

  const beginTalk = async (): Promise<void> => {
    if (resolvedState === 'thinking' || voicePhase === 'recording') return
    setError(null)
    setMenuOpen(false)
    setInputActive(false)
    setVoicePhase('preparing')
    try {
      const voice = await window.elio.ensureVoice()
      if (!voice.ready) {
        setError(voice.hint || 'Voz indisponível')
        setBarState('error')
        setVoicePhase('idle')
        return
      }
      const recorder = await startMicRecording()
      recorderRef.current = recorder
      recordStartedAt.current = Date.now()
      setVoicePhase('recording')
      setBarState('listening')
    } catch (err) {
      setError(micPermissionMessage(err))
      setBarState('error')
      setVoicePhase('idle')
    }
  }

  const endTalk = async (): Promise<void> => {
    const recorder = recorderRef.current
    if (!recorder || voicePhase !== 'recording') return
    recorderRef.current = null
    setVoicePhase('transcribing')
    setBarState('transcribing')
    try {
      if (Date.now() - recordStartedAt.current < 400) {
        recorder.cancel()
        setError('Áudio muito curto — segure e fale um pouco mais.')
        setBarState('error')
        setVoicePhase('idle')
        return
      }
      const audioBase64 = await recorder.stop()
      const { text } = await window.elio.transcribeVoice({ audioBase64 })
      const trimmed = text.trim()
      if (!trimmed) {
        setError('Não deu para entender — tente falar de novo.')
        setBarState('error')
        setVoicePhase('idle')
        return
      }
      // Junta com rascunho já digitado (se houver) e envia ao chat — MVP: fala = agir.
      const existing = draft.trim()
      const content = existing ? `${existing} ${trimmed}` : trimmed
      setVoicePhase('idle')
      await sendContent(content)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na transcrição')
      setBarState('error')
      setVoicePhase('idle')
    }
  }

  const busy =
    resolvedState === 'listening' ||
    resolvedState === 'transcribing' ||
    resolvedState === 'thinking'

  const showTextField = busy
    ? false
    : inputActive || draft.trim().length > 0 || resolvedState === 'error'

  const activateInput = (): void => {
    if (busy) return
    setInputActive(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

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
                resolvedState === 'thinking'
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
              <span>{STATE_LABEL[resolvedState]}</span>
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
                  inputRef.current?.blur()
                }
              }}
            />
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

        {resolvedState === 'offline' ? (
          <span className="fb-chip offline" title={status?.hint}>
            <WifiOff size={14} aria-hidden />
            <span className="fb-chip-label">offline</span>
          </span>
        ) : null}

        {resolvedState === 'error' && error ? (
          <span className="fb-chip error" title={error} aria-label={error}>
            !
          </span>
        ) : null}

        <button
          type="button"
          className={
            resolvedState === 'listening' ? 'fb-icon-btn mic active' : 'fb-icon-btn mic'
          }
          title={
            resolvedState === 'listening'
              ? 'Solte para enviar'
              : 'Segure para falar (envia ao chat)'
          }
          aria-label="Voz"
          aria-pressed={resolvedState === 'listening'}
          disabled={resolvedState === 'thinking' || voicePhase === 'transcribing'}
          onPointerDown={(e) => {
            e.preventDefault()
            void beginTalk()
          }}
          onPointerUp={() => void endTalk()}
          onPointerLeave={() => {
            if (voicePhase === 'recording') void endTalk()
          }}
          onPointerCancel={() => {
            recorderRef.current?.cancel()
            recorderRef.current = null
            setVoicePhase('idle')
            setBarState(offline ? 'offline' : 'idle')
          }}
        >
          <Mic size={16} />
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

      {error && resolvedState === 'error' ? (
        <div className="fb-error" role="alert" title={error}>
          {error}
        </div>
      ) : null}
    </div>
  )
}
