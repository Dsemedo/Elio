import type { TtsSettings } from '@shared/ipc'
import { prepareTextForSpeech, resolveTtsBackend } from '@shared/ttsPolicy'
import {
  hasPtBrSystemVoice,
  speakWithSystem,
  stopSystemSpeech,
  whenVoicesReady,
} from './systemTts'

export type TtsUiState = 'idle' | 'speaking' | 'error'

type Listener = (state: {
  ui: TtsUiState
  settings: TtsSettings | null
  error: string | null
  lastMessageId: string | null
}) => void

/**
 * Orquestra TTS no renderer (uma fala por vez, dedupe por message id).
 * - system: speechSynthesis (Windows SAPI/OneCore)
 * - edge: main sintetiza MP3 → HTMLAudioElement
 */
class TtsController {
  private settings: TtsSettings | null = null
  private ui: TtsUiState = 'idle'
  private error: string | null = null
  private lastMessageId: string | null = null
  private audio: HTMLAudioElement | null = null
  private objectUrl: string | null = null
  private systemStop: (() => void) | null = null
  private generation = 0
  private listeners = new Set<Listener>()
  private bootPromise: Promise<void> | null = null

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.snapshot())
    return () => {
      this.listeners.delete(listener)
    }
  }

  snapshot(): {
    ui: TtsUiState
    settings: TtsSettings | null
    error: string | null
    lastMessageId: string | null
  } {
    return {
      ui: this.ui,
      settings: this.settings,
      error: this.error,
      lastMessageId: this.lastMessageId,
    }
  }

  private emit(): void {
    const snap = this.snapshot()
    for (const listener of this.listeners) listener(snap)
  }

  async ensureBoot(): Promise<TtsSettings> {
    if (!this.bootPromise) {
      this.bootPromise = (async () => {
        this.settings = await window.elio.getTtsSettings()
        window.elio.onTtsSettings((s) => {
          this.settings = s
          this.emit()
        })
        await whenVoicesReady()
        this.emit()
      })()
    }
    await this.bootPromise
    return this.settings!
  }

  getSettings(): TtsSettings | null {
    return this.settings
  }

  async setEnabled(enabled: boolean): Promise<TtsSettings> {
    await this.ensureBoot()
    if (!enabled) await this.stop()
    this.settings = await window.elio.setTtsSettings({ enabled })
    this.emit()
    return this.settings
  }

  async setProvider(provider: TtsSettings['provider']): Promise<TtsSettings> {
    await this.ensureBoot()
    this.settings = await window.elio.setTtsSettings({ provider })
    this.emit()
    return this.settings
  }

  /**
   * Fala resposta do assistente se TTS estiver ligado.
   * Idempotente por messageId (Bar + Painel não duplicam).
   */
  async maybeSpeakAssistant(messageId: string, rawText: string): Promise<void> {
    const settings = await this.ensureBoot()
    if (!settings.enabled) return
    if (!messageId || messageId === this.lastMessageId) return
    const text = prepareTextForSpeech(rawText)
    if (!text) return
    this.lastMessageId = messageId
    await this.speakNow(text)
  }

  async speakNow(rawText: string): Promise<void> {
    const settings = await this.ensureBoot()
    const text = prepareTextForSpeech(rawText)
    if (!text) return

    const gen = ++this.generation
    await this.stopInternal(false)

    await whenVoicesReady()
    const backend = resolveTtsBackend({
      preference: settings.provider,
      systemPtBrAvailable: hasPtBrSystemVoice(),
    })

    this.ui = 'speaking'
    this.error = null
    this.emit()

    try {
      if (backend === 'system') {
        const handle = speakWithSystem(text, 'pt-BR')
        this.systemStop = handle.stop
        await handle.done
      } else {
        const result = await window.elio.synthesizeTts({
          text,
          voice: settings.edgeVoice,
        })
        if (gen !== this.generation) return
        await this.playBase64Mp3(result.audioBase64, result.mimeType)
      }
      if (gen !== this.generation) return
      this.ui = 'idle'
      this.emit()
    } catch (err) {
      if (gen !== this.generation) return
      // auto: se edge falhar, tenta system
      if (backend === 'edge' && settings.provider === 'auto' && hasPtBrSystemVoice()) {
        try {
          const handle = speakWithSystem(text, 'pt-BR')
          this.systemStop = handle.stop
          await handle.done
          if (gen !== this.generation) return
          this.ui = 'idle'
          this.error = null
          this.emit()
          return
        } catch {
          /* cai no erro abaixo */
        }
      }
      this.ui = 'error'
      this.error = err instanceof Error ? err.message : 'Falha no TTS'
      this.emit()
      // volta para idle sem gritar na UI se o usuário só leu o texto
      window.setTimeout(() => {
        if (this.generation === gen && this.ui === 'error') {
          this.ui = 'idle'
          this.emit()
        }
      }, 4000)
    }
  }

  private playBase64Mp3(base64: string, mimeType: string): Promise<void> {
    this.clearAudio()
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: mimeType })
    const url = URL.createObjectURL(blob)
    this.objectUrl = url
    const audio = new Audio(url)
    this.audio = audio
    return new Promise<void>((resolve, reject) => {
      audio.onended = () => {
        this.clearAudio()
        resolve()
      }
      audio.onerror = () => {
        this.clearAudio()
        reject(new Error('TTS_PLAYBACK: falha ao reproduzir áudio'))
      }
      void audio.play().catch((err) => {
        this.clearAudio()
        reject(err instanceof Error ? err : new Error('TTS_PLAYBACK'))
      })
    })
  }

  private clearAudio(): void {
    if (this.audio) {
      try {
        this.audio.pause()
        this.audio.src = ''
      } catch {
        /* ignore */
      }
      this.audio = null
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl)
      this.objectUrl = null
    }
  }

  private async stopInternal(notifyMain: boolean): Promise<void> {
    this.generation += 1
    this.systemStop?.()
    this.systemStop = null
    stopSystemSpeech()
    this.clearAudio()
    if (notifyMain) {
      try {
        await window.elio.stopTts()
      } catch {
        /* ignore */
      }
    }
  }

  async stop(): Promise<void> {
    await this.stopInternal(true)
    this.ui = 'idle'
    this.error = null
    this.emit()
  }
}

export const ttsController = new TtsController()
