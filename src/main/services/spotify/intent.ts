/**
 * Intents PT-BR para Spotify (play por nome / conectar).
 * Wake word “Elio” opcional; exige menção a Spotify ou “conectar Spotify”.
 */

export type SpotifyIntent =
  | { kind: 'spotify_play'; query: string | null }
  | { kind: 'spotify_connect' }
  | { kind: 'spotify_disconnect' }

function stripWake(text: string): string {
  return text
    .trim()
    .replace(/^(?:elio)[,:]?\s+/i, '')
    .replace(/[?.!]+$/g, '')
    .trim()
}

const CONNECT_RE =
  /^(?:(?:por\s+favor|pf|pode)\s+)?(?:conectar|conecte|ligar|autorizar)\s+(?:o\s+)?spotify\b/i

const DISCONNECT_RE =
  /^(?:(?:por\s+favor|pf|pode)\s+)?(?:desconectar|desconecte|desligar|sair\s+do)\s+(?:o\s+)?spotify\b/i

/**
 * Play genérico (sem nome): “toca uma música no Spotify”, “play spotify”.
 */
const PLAY_GENERIC_RE =
  /\b(?:tocar?|toque|reproduz(?:ir|a)?|play)\b[\s\S]*\bspotify\b|\bspotify\b[\s\S]*\b(?:tocar?|toque|reproduz(?:ir|a)?|play|m[uú]sica)\b|^(?:(?:por\s+favor|pf|pode)\s+)?(?:tocar?|toque)\s+(?:uma\s+|a\s+)?m[uú]sica(?:\s+(?:no|do)\s+spotify)\b/i

/** Remove ruído residual do nome da faixa. */
function cleanTrackQuery(raw: string): string | null {
  let q = raw
    .trim()
    .replace(/^["“']+|["”']+$/g, '')
    .replace(
      /^(?:a|o|uma|um)\s+(?:faixa|m[uú]sica|m[uú]sica\s+chamada|faixa\s+chamada|track|song)\s+/i,
      '',
    )
    .replace(/^(?:a|o|uma|um)\s+/i, '')
    .replace(/\s+(?:no|do)\s+spotify$/i, '')
    .replace(/[?.!]+$/g, '')
    .trim()

  // “essa/esta faixa” sem nome → play genérico
  if (/^(?:essa|esta|aquela)\s+(?:faixa|m[uú]sica)$/i.test(q)) {
    return null
  }
  if (/^(?:uma\s+)?m[uú]sica$/i.test(q) || /^uma$/i.test(q)) {
    return null
  }
  if (!q || q.length < 2) return null
  if (q.length > 120) q = q.slice(0, 120)
  return q
}

/**
 * Extrai nome da faixa: “toca Bohemian Rhapsody no Spotify”,
 * “toca a faixa X no Spotify”, “Spotify toca X”.
 */
function extractPlayQuery(content: string): string | null {
  const patterns = [
    /^(?:(?:por\s+favor|pf|pode)\s+)?(?:tocar?|toque|reproduz(?:ir|a)?|play)\s+(.+?)\s+(?:no|do|pelo)\s+spotify\b/i,
    /\bspotify\b[,:]?\s*(?:tocar?|toque|reproduz(?:ir|a)?|play)\s+(.+)$/i,
    /^(?:(?:por\s+favor|pf|pode)\s+)?(?:tocar?|toque)\s+(?:a\s+|o\s+)?(?:faixa|m[uú]sica)\s+(.+?)\s+(?:no|do)\s+spotify\b/i,
  ]
  for (const re of patterns) {
    const m = content.match(re)
    if (m?.[1]) {
      const cleaned = cleanTrackQuery(m[1])
      if (cleaned) return cleaned
    }
  }
  return null
}

export function parseSpotifyIntent(text: string): SpotifyIntent | null {
  const content = stripWake(text)
  if (!content) return null

  if (CONNECT_RE.test(content)) return { kind: 'spotify_connect' }
  if (DISCONNECT_RE.test(content)) return { kind: 'spotify_disconnect' }

  if (PLAY_GENERIC_RE.test(content)) {
    const query = extractPlayQuery(content)
    return { kind: 'spotify_play', query }
  }

  return null
}

export function describeSpotifyIntent(intent: SpotifyIntent): string {
  switch (intent.kind) {
    case 'spotify_play':
      return intent.query
        ? `Colocando “${intent.query}” no Spotify…`
        : 'Abrindo Spotify…'
    case 'spotify_connect':
      return 'Conectando Spotify…'
    case 'spotify_disconnect':
      return 'Desconectando Spotify…'
  }
}

/** Heurística UI (Floating Bar) — espelha parse sem depender do main. */
export function looksLikeSpotifyCommand(text: string): boolean {
  return parseSpotifyIntent(text) !== null
}
