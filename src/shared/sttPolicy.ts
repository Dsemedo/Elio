/**
 * Política de STT (ADR 0019 / A0a):
 * - `auto` → Sherpa-ONNX (local pt-BR)
 * - `whisper` → Whisper.cpp (fallback / force)
 * - `windows-speech` → Web Speech só com force; senão Whisper
 */

export type SttPreference = 'auto' | 'windows-speech' | 'whisper' | 'sherpa'
export type SttBackend = 'windows-speech' | 'whisper' | 'sherpa'

export function parseSttPreference(raw: string | undefined | null): SttPreference {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === 'whisper' || v === 'windows-speech' || v === 'auto' || v === 'sherpa') {
    return v
  }
  return 'auto'
}

/**
 * Escolhe o backend de STT para um PTT.
 * - `auto` / `sherpa` → Sherpa-ONNX
 * - `whisper` → Whisper
 * - `windows-speech` → Web Speech se API existir; senão Whisper
 */
export function resolveSttBackend(input: {
  platform: string
  speechRecognitionAvailable: boolean
  preference?: SttPreference
}): SttBackend {
  void input.platform
  const preference = input.preference ?? 'auto'

  if (preference === 'windows-speech') {
    return input.speechRecognitionAvailable ? 'windows-speech' : 'whisper'
  }

  if (preference === 'whisper') {
    return 'whisper'
  }

  // auto | sherpa
  return 'sherpa'
}

/** True se o backend grava WAV e manda ao main (Sherpa ou Whisper). */
export function isLocalWavBackend(backend: SttBackend): boolean {
  return backend === 'sherpa' || backend === 'whisper'
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
 * Erros ao **iniciar** o Speech que justificam cair no WAV local (Whisper/Sherpa).
 *
 * NÃO cai quando:
 * - permissão negada
 * - no-speech / aborted / texto vazio
 *
 * `null`/desconhecido no start → ainda permite fallback.
 */
export function shouldFallbackToWhisper(errorCode: string | undefined | null): boolean {
  if (isSpeechPermissionDenied(errorCode)) return false
  if (!errorCode) return true
  const code = errorCode.toLowerCase()
  if (code.includes('no-speech') || code.includes('aborted')) return false
  return true
}

/** Mensagem quando o Speech não devolveu texto (sem Whisper nesta fala). */
export function emptySpeechUserMessage(
  errorCode: string | undefined | null = 'no-speech',
): string {
  const code = (errorCode ?? 'no-speech').toLowerCase()
  if (isSpeechPermissionDenied(code)) {
    return windowsSpeechUserMessage(new Error(`WINDOWS_SPEECH_ERROR:${code}`))
  }
  if (code.includes('no-speech')) {
    return 'Não ouvi nada — segure o mic e fale um pouco mais.'
  }
  if (code.includes('aborted')) {
    return 'Captura interrompida — tente de novo.'
  }
  return 'Falha no reconhecimento de fala do Windows — tente de novo.'
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
