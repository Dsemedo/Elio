/**
 * Web Speech API (SpeechRecognition / webkitSpeechRecognition) com semântica PTT.
 * No Electron/Chromium no Windows isso usa o Windows Speech Runtime (pt-BR).
 */

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
  recognition.continuous = true
  recognition.interimResults = true
  recognition.maxAlternatives = 1

  let finalText = ''
  let interimText = ''
  let settled = false
  let started = false
  let rejectStart: ((err: Error) => void) | null = null
  let resolveStop: ((text: string) => void) | null = null
  let rejectStop: ((err: Error) => void) | null = null

  const finishOk = (text: string): void => {
    if (settled) return
    settled = true
    resolveStop?.(text)
    resolveStop = null
    rejectStop = null
  }

  const finishErr = (err: Error): void => {
    if (settled) return
    settled = true
    rejectStop?.(err)
    resolveStop = null
    rejectStop = null
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
    // no-speech / aborted: devolve o que tiver ao parar.
    if (code === 'no-speech' || code === 'aborted') {
      finishOk(finalText.trim() || interimText.trim())
      return
    }
    finishErr(err)
  }

  recognition.onend = () => {
    finishOk(finalText.trim() || interimText.trim())
  }

  await new Promise<void>((resolve, reject) => {
    rejectStart = (e) => reject(e)
    recognition.onstart = () => {
      started = true
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
      settled = true
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
          resolve(finalText.trim() || interimText.trim())
          return
        }
        resolveStop = resolve
        rejectStop = reject
        try {
          recognition.stop()
        } catch (e) {
          finishErr(e instanceof Error ? e : new Error(String(e)))
        }
        // Segurança: se onend não vier, resolve com o que tiver.
        globalThis.setTimeout(() => {
          finishOk(finalText.trim() || interimText.trim())
        }, 2_500)
      }),
  }
}

export { windowsSpeechUserMessage as windowsSpeechErrorMessage } from '@shared/sttPolicy'
