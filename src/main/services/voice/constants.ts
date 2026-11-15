/** Pin oficial whisper.cpp (release com assets Windows/Linux). */
export const WHISPER_RELEASE = 'v1.9.2'

/** Modelo multilíngue padrão — OD-05 fechado para PT-BR (feedback Douglas). */
export const MODEL_ID = 'base' as const
export const MODEL_FILE = 'ggml-base.bin'

/** Modelo antigo (v0.3 voz); usuário pode apagar após migrar. */
export const LEGACY_MODEL_FILE = 'ggml-tiny.bin'

/**
 * ~148 MB — Hugging Face (ggerganov/whisper.cpp).
 * `?download=true` evita página HTML intermediária no Hub.
 */
export const MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin?download=true'

/** Tamanho aproximado para UX (modelo + binário). */
export const MODEL_SIZE_HINT_MB = 150

/** Tamanho mínimo aceitável após download (proteção contra HTML/erro). */
export const MODEL_MIN_BYTES = 100_000_000
export const BINARY_ARCHIVE_MIN_BYTES = 1_000_000

export const MIN_AUDIO_MS = 400
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024
export const TRANSCRIBE_TIMEOUT_MS = 90_000
export const DOWNLOAD_TIMEOUT_MS = 10 * 60_000
export const DOWNLOAD_MAX_ATTEMPTS = 3
export const DOWNLOAD_RETRY_DELAY_MS = 1_500

export type VoiceErrorCode =
  | 'WHISPER_MISSING'
  | 'MODEL_MISSING'
  | 'AUDIO_TOO_SHORT'
  | 'AUDIO_INVALID'
  | 'TRANSCRIBE_FAILED'
  | 'DOWNLOAD_FAILED'
  | 'EXTRACT_FAILED'
  | 'INSTALL_FAILED'
  | 'UNSUPPORTED_PLATFORM'

export function binaryArchiveUrl(platform: NodeJS.Platform): string | null {
  if (platform === 'win32') {
    return `https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_RELEASE}/whisper-bin-x64.zip`
  }
  if (platform === 'linux') {
    return `https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_RELEASE}/whisper-bin-ubuntu-x64.tar.gz`
  }
  return null
}

export function binaryFileName(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'
}
