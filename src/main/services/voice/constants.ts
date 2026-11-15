/** Pin oficial whisper.cpp (release com assets Windows/Linux). */
export const WHISPER_RELEASE = 'v1.9.2'

export const MODEL_ID = 'tiny' as const
export const MODEL_FILE = 'ggml-tiny.bin'

/** ~75 MB — Hugging Face (ggerganov/whisper.cpp). */
export const MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin'

export const MIN_AUDIO_MS = 400
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024
export const TRANSCRIBE_TIMEOUT_MS = 90_000
export const DOWNLOAD_TIMEOUT_MS = 10 * 60_000

export type VoiceErrorCode =
  | 'WHISPER_MISSING'
  | 'MODEL_MISSING'
  | 'AUDIO_TOO_SHORT'
  | 'AUDIO_INVALID'
  | 'TRANSCRIBE_FAILED'
  | 'DOWNLOAD_FAILED'
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
