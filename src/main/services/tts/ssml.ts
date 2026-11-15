/** Escapa texto para inclusão em SSML (evita quebra / injection de tags). */
export function escapeXmlForSsml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const EDGE_VOICE_RE = /^[A-Za-z]{2}-[A-Za-z]{2}-[A-Za-z0-9]+$/

/** Aceita só nomes no formato edge (ex.: pt-BR-FranciscaNeural). */
export function sanitizeEdgeVoice(
  voice: string,
  fallback = 'pt-BR-FranciscaNeural',
): string {
  const trimmed = voice.trim()
  if (EDGE_VOICE_RE.test(trimmed)) return trimmed
  const match = trimmed.match(/[A-Za-z]{2}-[A-Za-z]{2}-[A-Za-z0-9]+/)
  return match?.[0] ?? fallback
}

/** Monta SSML mínimo para edge-tts (voz pt-BR neural). */
export function buildEdgeSsml(text: string, voice: string): string {
  const safeVoice = sanitizeEdgeVoice(voice)
  const body = escapeXmlForSsml(text)
  return (
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='pt-BR'>` +
    `<voice name='${safeVoice}'>${body}</voice>` +
    `</speak>`
  )
}
