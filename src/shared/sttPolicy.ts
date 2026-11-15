/** Política de STT: Windows Speech primário no Windows; Whisper só fallback. */

export type SttPreference = 'auto' | 'windows-speech' | 'whisper'
export type SttBackend = 'windows-speech' | 'whisper'

export function parseSttPreference(raw: string | undefined | null): SttPreference {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === 'whisper' || v === 'windows-speech' || v === 'auto') return v
  return 'auto'
}

/**
 * Escolhe o backend de STT para um PTT.
 * - No Windows com Web Speech disponível → windows-speech (salvo force whisper).
 * - Fora do Windows, ou sem SpeechRecognition → whisper.
 */
export function resolveSttBackend(input: {
  platform: string
  speechRecognitionAvailable: boolean
  preference?: SttPreference
}): SttBackend {
  const preference = input.preference ?? 'auto'

  if (preference === 'whisper') return 'whisper'

  if (preference === 'windows-speech') {
    return input.speechRecognitionAvailable ? 'windows-speech' : 'whisper'
  }

  // auto
  if (input.platform === 'win32' && input.speechRecognitionAvailable) {
    return 'windows-speech'
  }
  return 'whisper'
}

/** Erros da Web Speech API que justificam cair no Whisper (áudio paralelo). */
export function shouldFallbackToWhisper(errorCode: string | undefined | null): boolean {
  if (!errorCode) return true
  const code = errorCode.toLowerCase()
  // Permissão negada: Whisper também precisa do mic — não adianta.
  if (code === 'not-allowed' || code === 'service-not-allowed') return false
  return true
}
