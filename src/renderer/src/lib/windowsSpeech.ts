/**
 * Web Speech API (SpeechRecognition / webkitSpeechRecognition) com semântica PTT.
 * No Electron/Chromium no Windows isso usa o Windows Speech Runtime (pt-BR).
 *
 * Importante: durante o hold, `no-speech` / `onend` NÃO podem encerrar a sessão
 * cedo — senão o usuário fala e, ao soltar, recebe texto vazio.
 *
 * Quirk Chromium/Web Speech: NÃO chamar `recognition.start()` de forma síncrona
 * dentro de `onend` — a sessão anterior ainda não terminou de desmontar e o
 * `start()` falha (InvalidStateError) ou vira no-op silencioso. Reinício sempre
 * via setTimeout curto, com flag de intenção (`stopping`) revalidada.
 */

import {
  SPEECH_RESTART_DELAY_MS,
  canFinishSpeechStopWithoutEngine,
  shouldScheduleSpeechRestart,
} from '@shared/speechRestart'

export { SPEECH_RESTART_DELAY_MS } from '@shared/speechRestart'

export type WindowsSpeechSession = {
  /** Para o reconhecimento e devolve o texto final (ou interim se não houver final). */
  stop: () => Promise<string>
  /** Aborta sem esperar resultado. */
  cancel: () => void
}

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onstart: ((ev: Event) => void) | null
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null
  onerror: ((ev: SpeechRecognitionErrorLike) => void) | null
  onend: ((ev: Event) => void) | null
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    0?: { transcript?: string }
  } & { length: number }>
}

type SpeechRecognitionErrorLike = {
  error: string
  message?: string
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** true se o Chromium expõe SpeechRecognition neste renderer. */
export function isWindowsSpeechAvailable(): boolean {
  return getSpeechRecognitionCtor() !== null
}

/**
 * Inicia reconhecimento contínuo (PTT: chame stop() ao soltar o mic).
 * Rejeita se a API não existir ou falhar ao start.
 */
export async function startWindowsSpeech(opts?: {
  lang?: string
}): Promise<WindowsSpeechSession> {
  const Ctor = getSpeechRecognitionCtor()
  if (!Ctor) {
    throw new Error('WINDOWS_SPEECH_UNAVAILABLE')
  }

  const recognition = new Ctor()
  recognition.lang = opts?.lang ?? 'pt-BR'
  // continuous: frases curtas do PTT ainda usam continuous para não cortar no
  // silêncio no meio do hold; no stop() esperamos finais com margem maior.
  recognition.continuous = true
  recognition.interimResults = true
  // Alternativa 0 = maior confiança no Chromium/Windows Speech.
  recognition.maxAlternatives = 3

  let finalText = ''
  let interimText = ''
  let settled = false
  let started = false
  /** true enquanto o motor reporta sessão ativa (entre onstart e onend). */
  let listening = false
  /** true depois que o usuário pediu stop/cancel — não reiniciar. */
  let stopping = false
  let restartTimer: ReturnType<typeof setTimeout> | null = null
  let rejectStart: ((err: Error) => void) | null = null
  let resolveStop: ((text: string) => void) | null = null
  let rejectStop: ((err: Error) => void) | null = null

  const clearRestartTimer = (): void => {
    if (restartTimer !== null) {
      globalThis.clearTimeout(restartTimer)
      restartTimer = null
    }
  }

  const bestText = (): string => finalText.trim() || interimText.trim()

  const finishOk = (text: string): void => {
    if (settled) return
    settled = true
    clearRestartTimer()
    resolveStop?.(text)
    resolveStop = null
    rejectStop = null
  }

  const finishErr = (err: Error): void => {
    if (settled) return
    settled = true
    clearRestartTimer()
    rejectStop?.(err)
    resolveStop = null
    rejectStop = null
  }

  const tryRestart = (): void => {
    if (!shouldScheduleSpeechRestart({ settled, stopping })) return
    clearRestartTimer()
    // Nunca start() síncrono no onend — ver SPEECH_RESTART_DELAY_MS.
    restartTimer = globalThis.setTimeout(() => {
      restartTimer = null
      if (!shouldScheduleSpeechRestart({ settled, stopping }) || listening) return
      try {
        recognition.start()
      } catch (e) {
        console.info('[elio:speech] restart falhou', e)
      }
    }, SPEECH_RESTART_DELAY_MS)
  }

  recognition.onresult = (event) => {
    let interim = ''
    let chunkFinal = ''
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i]
      if (!result) continue
      const transcript = result[0]?.transcript ?? ''
      if (result.isFinal) {
        chunkFinal += transcript
      } else {
        interim += transcript
      }
    }
    if (chunkFinal) {
      finalText = `${finalText} ${chunkFinal}`.trim()
    }
    interimText = interim
  }

  recognition.onerror = (event) => {
    const code = event.error || 'unknown'
    const err = new Error(`WINDOWS_SPEECH_ERROR:${code}`)
    if (!started) {
      rejectStart?.(err)
      return
    }
    // no-speech no meio do hold: o runtime encerra o reconhecimento.
    // NÃO marcar settled — onend reinicia (com delay) enquanto o usuário segura.
    if (code === 'no-speech') {
      console.info('[elio:speech] no-speech — vai reiniciar no onend se PTT ativo')
      return
    }
    if (code === 'aborted') {
      finishOk(bestText())
      return
    }
    finishErr(err)
  }

  recognition.onend = () => {
    listening = false
    if (settled) return
    if (stopping || resolveStop) {
      finishOk(bestText())
      return
    }
    // Ainda no PTT — reinicia após o motor desmontar de verdade.
    tryRestart()
  }

  await new Promise<void>((resolve, reject) => {
    rejectStart = (e) => reject(e)
    recognition.onstart = () => {
      started = true
      listening = true
      resolve()
    }
    try {
      recognition.start()
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)))
    }
  })

  return {
    cancel: () => {
      stopping = true
      settled = true
      clearRestartTimer()
      resolveStop = null
      rejectStop = null
      try {
        recognition.abort()
      } catch {
        /* ignore */
      }
    },
    stop: () =>
      new Promise<string>((resolve, reject) => {
        if (settled) {
          resolve(bestText())
          return
        }
        stopping = true
        clearRestartTimer()
        resolveStop = resolve
        rejectStop = reject

        // Sessão já acabou (ex.: no-speech) e o restart ainda não armou —
        // não há onend futuro; devolve o que tiver agora.
        if (canFinishSpeechStopWithoutEngine({ settled, listening })) {
          finishOk(bestText())
          return
        }

        try {
          recognition.stop()
        } catch (e) {
          finishErr(e instanceof Error ? e : new Error(String(e)))
        }
        // Margem para o Windows Speech emitir isFinal antes do onend.
        globalThis.setTimeout(() => {
          finishOk(bestText())
        }, 4_000)
      }),
  }
}

export { windowsSpeechUserMessage as windowsSpeechErrorMessage } from '@shared/sttPolicy'
