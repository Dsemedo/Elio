/** Mensagens curtas em português — sem paths nem conteúdo de áudio. */

const KNOWN_PREFIXES = [
  'AUDIO_TOO_SHORT',
  'AUDIO_INVALID',
  'WHISPER_MISSING',
  'SHERPA_MISSING',
  'MODEL_MISSING',
  'DOWNLOAD_FAILED',
  'EXTRACT_FAILED',
  'INSTALL_FAILED',
  'UNSUPPORTED_PLATFORM',
  'TRANSCRIBE_FAILED',
] as const

export function hasVoiceErrorPrefix(raw: string): boolean {
  return KNOWN_PREFIXES.some((prefix) => raw.startsWith(prefix))
}

/** Detalhe seguro para log (sem path absoluto). */
export function serializeVoiceError(err: unknown): {
  name: string
  message: string
  code?: string
  cause?: string
} {
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code
    const cause =
      err.cause instanceof Error
        ? err.cause.message.slice(0, 300)
        : typeof err.cause === 'string'
          ? err.cause.slice(0, 300)
          : undefined
    return {
      name: err.name,
      message: err.message.slice(0, 500),
      ...(code ? { code } : {}),
      ...(cause ? { cause } : {}),
    }
  }
  return { name: 'Unknown', message: String(err).slice(0, 500) }
}

export function logVoiceError(
  context: string,
  err: unknown,
  extra?: Record<string, unknown>,
): void {
  console.error(`[elio] ${context}`, { ...serializeVoiceError(err), ...extra })
}

/** Normaliza erros crus (Node/Abort) para código tipado de voz. */
export function normalizeVoiceEnsureError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err)
  if (hasVoiceErrorPrefix(message)) {
    return err instanceof Error ? err : new Error(message)
  }

  const name = err instanceof Error ? err.name : ''
  const code = err instanceof Error ? (err as NodeJS.ErrnoException).code : undefined
  const lower = message.toLowerCase()

  if (
    name === 'AbortError' ||
    lower.includes('aborted') ||
    lower.includes('timeout') ||
    code === 'ABORT_ERR'
  ) {
    return new Error(
      'DOWNLOAD_FAILED: tempo esgotado ao baixar o modelo de voz. Tente de novo com internet estável.',
    )
  }

  if (
    code === 'ENOTFOUND' ||
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ENETUNREACH' ||
    lower.includes('fetch failed') ||
    lower.includes('network')
  ) {
    return new Error(
      'DOWNLOAD_FAILED: sem conexão para baixar o modelo de voz. Confira a internet e tente de novo.',
    )
  }

  if (code === 'EPERM' || code === 'EACCES' || code === 'EBUSY' || code === 'EEXIST') {
    return new Error(
      'INSTALL_FAILED: o Windows bloqueou a instalação da voz (permissão ou antivírus). Tente de novo.',
    )
  }

  return new Error(`DOWNLOAD_FAILED: não foi possível preparar a voz (${message.slice(0, 180)})`)
}

export function friendlyVoiceError(raw: string): string {
  if (raw.startsWith('AUDIO_TOO_SHORT')) {
    return 'Áudio muito curto — segure o botão e fale um pouco mais.'
  }
  if (raw.startsWith('AUDIO_INVALID')) {
    return 'Não consegui ler o áudio. Tente de novo.'
  }
  if (raw.startsWith('WHISPER_MISSING')) {
    return 'O Whisper não está disponível. Use “Preparar voz” ou verifique a internet.'
  }
  if (raw.startsWith('SHERPA_MISSING')) {
    return 'O reconhecimento local (Sherpa) não está disponível. Use “Preparar voz” ou verifique a internet.'
  }
  if (raw.startsWith('MODEL_MISSING')) {
    return 'O modelo de voz ainda não foi baixado. Use “Preparar voz”.'
  }
  if (raw.startsWith('EXTRACT_FAILED')) {
    return 'Baixei o modelo de voz, mas não consegui extrair. Tente de novo (antivírus pode bloquear).'
  }
  if (raw.startsWith('INSTALL_FAILED')) {
    return 'Não consegui instalar o reconhecimento de voz nesta pasta. Feche o antivírus temporariamente e tente de novo.'
  }
  if (raw.startsWith('DOWNLOAD_FAILED')) {
    if (/tempo esgotado|timeout|abort/i.test(raw)) {
      return 'O download do modelo de voz demorou demais. Confira a internet e tente de novo.'
    }
    if (/sem conexão|ENOTFOUND|ECONN|fetch failed|network/i.test(raw)) {
      return 'Sem conexão para baixar o modelo de voz. Confira a internet e tente de novo.'
    }
    if (/HTTP 429|HTTP 5\d\d/i.test(raw)) {
      return 'O servidor do modelo está ocupado. Espere um minuto e tente de novo.'
    }
    return 'Falha no download do modelo de voz. Confira a internet e tente de novo.'
  }
  if (raw.startsWith('UNSUPPORTED_PLATFORM')) {
    return 'Voz no MVP é para Windows 10/11 x64.'
  }
  if (raw.startsWith('TRANSCRIBE_FAILED')) {
    return 'A transcrição falhou. Tente falar de novo, com menos ruído.'
  }
  // Não vaza detalhes internos.
  return 'Não foi possível usar a voz agora. Você ainda pode digitar.'
}
