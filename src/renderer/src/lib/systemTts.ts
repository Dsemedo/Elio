/**
 * TTS do sistema via Web Speech API (speechSynthesis).
 * No Windows/Electron → vozes SAPI / OneCore instaladas (pt-BR se o pacote existir).
 * Offline, sem IPC de áudio, least privilege.
 */

export function isSpeechSynthesisAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function listPtBrVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSynthesisAvailable()) return []
  return window.speechSynthesis.getVoices().filter((v) => {
    const lang = (v.lang || '').toLowerCase()
    return lang === 'pt-br' || lang.startsWith('pt-br') || lang === 'pt_br'
  })
}

/** true se há voz pt-BR (ou pt) utilizável. */
export function hasPtBrSystemVoice(): boolean {
  if (!isSpeechSynthesisAvailable()) return false
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return false
  return voices.some((v) => {
    const lang = (v.lang || '').toLowerCase()
    return lang.startsWith('pt')
  })
}

/**
 * Chromium às vezes popula vozes de forma assíncrona.
 * Resolve quando getVoices() retornar algo ou após timeout curto.
 */
export function whenVoicesReady(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  if (!isSpeechSynthesisAvailable()) return Promise.resolve([])
  const existing = window.speechSynthesis.getVoices()
  if (existing.length > 0) return Promise.resolve(existing)

  return new Promise((resolve) => {
    const done = (): void => {
      window.speechSynthesis.removeEventListener('voiceschanged', onChange)
      resolve(window.speechSynthesis.getVoices())
    }
    const onChange = (): void => done()
    window.speechSynthesis.addEventListener('voiceschanged', onChange)
    window.setTimeout(done, timeoutMs)
  })
}

export type SystemSpeakHandle = {
  stop: () => void
  done: Promise<void>
}

export function speakWithSystem(text: string, lang = 'pt-BR'): SystemSpeakHandle {
  if (!isSpeechSynthesisAvailable()) {
    return {
      stop: () => undefined,
      done: Promise.reject(new Error('TTS_SYSTEM_UNAVAILABLE: speechSynthesis ausente')),
    }
  }

  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = lang
  const pt = listPtBrVoices()
  const preferred =
    pt.find((v) => /maria|francisca|antonio|daniel|heli/i.test(v.name)) ?? pt[0]
  if (preferred) utter.voice = preferred
  utter.rate = 1.05

  let settle: (() => void) | null = null
  let rejectFn: ((err: Error) => void) | null = null
  const done = new Promise<void>((resolve, reject) => {
    settle = resolve
    rejectFn = reject
  })

  utter.onend = () => settle?.()
  utter.onerror = (ev) => {
    if (ev.error === 'canceled' || ev.error === 'interrupted') {
      settle?.()
      return
    }
    rejectFn?.(new Error(`TTS_SYSTEM_ERROR:${ev.error || 'unknown'}`))
  }

  window.speechSynthesis.speak(utter)

  return {
    stop: () => {
      window.speechSynthesis.cancel()
      settle?.()
    },
    done,
  }
}

export function stopSystemSpeech(): void {
  if (!isSpeechSynthesisAvailable()) return
  window.speechSynthesis.cancel()
}
