/** Política de TTS: system (SAPI/speechSynthesis) local; edge-tts neural com rede. */

export type TtsPreference = 'auto' | 'system' | 'edge'
export type TtsBackend = 'system' | 'edge'

export function parseTtsPreference(raw: string | undefined | null): TtsPreference {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === 'system' || v === 'edge' || v === 'auto') return v
  return 'auto'
}

export function parseTtsEnabled(raw: string | undefined | null): boolean | null {
  if (raw === undefined || raw === null) return null
  const v = raw.trim().toLowerCase()
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false
  return null
}

/**
 * Escolhe o backend de TTS.
 * - auto: system se houver voz pt-BR; senão edge (precisa rede).
 * - system / edge: força o caminho (edge sem rede falha com aviso).
 */
export function resolveTtsBackend(input: {
  preference?: TtsPreference
  systemPtBrAvailable: boolean
}): TtsBackend {
  const preference = input.preference ?? 'auto'
  if (preference === 'system') return 'system'
  if (preference === 'edge') return 'edge'
  return input.systemPtBrAvailable ? 'system' : 'edge'
}

/** Limite de caracteres falados por resposta (evita SSML/WS enormes). */
export const TTS_MAX_CHARS = 4000

/**
 * Remove markdown leve e compacta whitespace para fala.
 * Não interpreta HTML — só limpeza superficial de texto de chat.
 */
export function prepareTextForSpeech(raw: string, maxChars = TTS_MAX_CHARS): string {
  let text = raw.replace(/\r\n/g, '\n')
  // code fences
  text = text.replace(/```[\s\S]*?```/g, ' ')
  text = text.replace(/`([^`]+)`/g, '$1')
  // links [label](url) → label
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  // headings / emphasis
  text = text.replace(/^#{1,6}\s+/gm, '')
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2')
  text = text.replace(/(\*|_)(.*?)\1/g, '$2')
  text = text.replace(/\s+/g, ' ').trim()
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars - 1).trimEnd()}…`
}
