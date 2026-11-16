/** Pin oficial whisper.cpp (release com assets Windows/Linux). */
export const WHISPER_RELEASE = 'v1.9.2'

/** Modelos multilíngues suportados via `ELIO_WHISPER_MODEL`. */
export const WHISPER_MODEL_IDS = ['tiny', 'base', 'small'] as const
export type WhisperModelId = (typeof WHISPER_MODEL_IDS)[number]

/** Default OD-05 / PJ-25: `small` + `-l pt` (base ainda mangla frases PT-BR). */
export const DEFAULT_MODEL_ID: WhisperModelId = 'small'

const MODEL_META: Record<
  WhisperModelId,
  { file: string; sizeHintMb: number; minBytes: number }
> = {
  tiny: { file: 'ggml-tiny.bin', sizeHintMb: 75, minBytes: 30_000_000 },
  base: { file: 'ggml-base.bin', sizeHintMb: 150, minBytes: 100_000_000 },
  small: { file: 'ggml-small.bin', sizeHintMb: 466, minBytes: 400_000_000 },
}

export type ResolvedWhisperModel = {
  id: WhisperModelId
  file: string
  url: string
  sizeHintMb: number
  minBytes: number
}

export function resolveWhisperModel(
  env: NodeJS.ProcessEnv = process.env,
): ResolvedWhisperModel {
  const raw = env['ELIO_WHISPER_MODEL']?.trim().toLowerCase()
  const id: WhisperModelId =
    raw && (WHISPER_MODEL_IDS as readonly string[]).includes(raw)
      ? (raw as WhisperModelId)
      : DEFAULT_MODEL_ID
  const meta = MODEL_META[id]
  return {
    id,
    file: meta.file,
    url: `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${meta.file}?download=true`,
    sizeHintMb: meta.sizeHintMb,
    minBytes: meta.minBytes,
  }
}

/** Snapshot default (sem ler env) — útil em tipos/docs; runtime usa `resolveWhisperModel()`. */
export const MODEL_ID = DEFAULT_MODEL_ID
export const MODEL_FILE = MODEL_META[DEFAULT_MODEL_ID].file
export const MODEL_URL =
  `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL_FILE}?download=true`
export const MODEL_SIZE_HINT_MB = MODEL_META[DEFAULT_MODEL_ID].sizeHintMb
export const MODEL_MIN_BYTES = MODEL_META[DEFAULT_MODEL_ID].minBytes

/** Modelos antigos que o usuário pode apagar após migrar. */
export const LEGACY_MODEL_FILES = ['ggml-tiny.bin', 'ggml-base.bin'] as const

/**
 * Prompt inicial PT-BR (whisper-cli `--prompt`) — viés lexical para frases do assistente.
 * Não é enviado ao LLM; só condiciona o decoder local.
 * Inclui “atual” de propósito (Whisper `small` costuma manglar para “outdoor”).
 */
export const WHISPER_INITIAL_PROMPT =
  'Oi. Qual é a hora? Que horas são? Qual é o horário atual? ' +
  'Qual é o clima atual? Qual é o clima atual do lugar que eu moro? ' +
  'Como está o tempo hoje? ' +
  'Abre o Chrome. Abre a pasta Downloads. Conectar Spotify. Toca uma música. ' +
  'Obrigado. Por favor.'

/**
 * Beam size do whisper-cli (`-bs`). Maior = um pouco mais lento, melhor em
 * frases curtas PT-BR do assistente (fallback).
 */
export const WHISPER_BEAM_SIZE = 8

/** Tamanho mínimo aceitável do arquivo do binário. */
export const BINARY_ARCHIVE_MIN_BYTES = 1_000_000

export const MIN_AUDIO_MS = 400
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024
/** `small` é mais lento que `base` no CPU — margem maior. */
export const TRANSCRIBE_TIMEOUT_MS = 180_000
export const DOWNLOAD_TIMEOUT_MS = 15 * 60_000
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
