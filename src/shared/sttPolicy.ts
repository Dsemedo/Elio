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

/**
 * Extrai o código da Web Speech API de `WINDOWS_SPEECH_ERROR:not-allowed`
 * (ou devolve o texto cru em minúsculas).
 */
export function extractWindowsSpeechErrorCode(
  raw: string | undefined | null,
): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  const prefix = 'WINDOWS_SPEECH_ERROR:'
  const idx = trimmed.toUpperCase().indexOf(prefix)
  if (idx >= 0) {
    return trimmed.slice(idx + prefix.length).trim().toLowerCase() || null
  }
  return trimmed.toLowerCase()
}

/** true se o Speech falhou por permissão (não cair no Whisper em silêncio). */
export function isSpeechPermissionDenied(
  errorCode: string | undefined | null,
): boolean {
  if (!errorCode) return false
  const code = errorCode.toLowerCase()
  return code.includes('not-allowed') || code.includes('service-not-allowed')
}

/**
 * Erros da Web Speech API que justificam cair no Whisper (áudio paralelo).
 * Permissão negada NÃO entra — a UI mostra chip PT-BR e o usuário ajusta o Windows.
 */
export function shouldFallbackToWhisper(errorCode: string | undefined | null): boolean {
  if (isSpeechPermissionDenied(errorCode)) return false
  return true
}

/** Motivo curto (sem código cru longo) para o chip/status da barra. */
export function whisperFallbackStatusMessage(
  errorCode: string | undefined | null,
): string {
  const code = (errorCode ?? '').toLowerCase().trim()
  if (!code) return 'Speech falhou — Whisper'
  if (code.includes('network')) return 'Speech falhou (rede) — Whisper'
  if (code.includes('audio-capture')) return 'Speech falhou (áudio) — Whisper'
  if (code.includes('no-speech')) return 'Speech sem fala — Whisper'
  if (code.includes('aborted')) return 'Speech interrompido — Whisper'
  if (code.includes('language-not-supported')) return 'Speech sem pt-BR — Whisper'
  if (code.includes('unavailable')) return 'Speech indisponível — Whisper'
  const short = code.replace(/[^a-z0-9-]+/g, '').slice(0, 18)
  return short ? `Speech falhou (${short}) — Whisper` : 'Speech falhou — Whisper'
}

/** Mensagem curta em PT para a barra (sem códigos crus que truncam). */
export function windowsSpeechUserMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const code = extractWindowsSpeechErrorCode(raw) ?? raw.toLowerCase()
  if (code.includes('not-allowed') || code.includes('service-not-allowed')) {
    return 'Microfone/fala bloqueados — Windows: Privacidade → Microfone (apps de desktop / Elio)'
  }
  if (raw.includes('WINDOWS_SPEECH_UNAVAILABLE') || code.includes('unavailable')) {
    return 'Reconhecimento de fala do Windows indisponível neste ambiente.'
  }
  return 'Falha no reconhecimento de fala do Windows.'
}

/**
 * Última linha de defesa na UI: nunca mostrar `WINDOWS_SPEECH_ERROR:…` cru
 * (o chip da Floating Bar trunca e assusta). Outras mensagens passam.
 */
export function sanitizeVoiceUiError(message: string | null | undefined): string {
  if (!message) return 'Falha na voz — tente de novo.'
  if (/WINDOWS_SPEECH/i.test(message)) {
    return windowsSpeechUserMessage(new Error(message))
  }
  return message
}
