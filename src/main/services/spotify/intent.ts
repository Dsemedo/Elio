/**
 * Intents PT-BR para Spotify (play / conectar).
 * Wake word “Elio” opcional; exige menção a Spotify ou “conectar Spotify”.
 */

export type SpotifyIntent =
  | { kind: 'spotify_play' }
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
 * Play: menção a Spotify + verbo de tocar/reproduzir/música,
 * ou “toca/tocar uma música no Spotify”.
 */
const PLAY_RE =
  /\b(?:tocar?|toque|reproduz(?:ir|a)?|play)\b[\s\S]*\bspotify\b|\bspotify\b[\s\S]*\b(?:tocar?|toque|reproduz(?:ir|a)?|play|m[uú]sica)\b|^(?:(?:por\s+favor|pf|pode)\s+)?(?:tocar?|toque)\s+(?:uma\s+|a\s+)?m[uú]sica(?:\s+(?:no|do)\s+spotify)\b/i

export function parseSpotifyIntent(text: string): SpotifyIntent | null {
  const content = stripWake(text)
  if (!content) return null

  if (CONNECT_RE.test(content)) return { kind: 'spotify_connect' }
  if (DISCONNECT_RE.test(content)) return { kind: 'spotify_disconnect' }
  if (PLAY_RE.test(content)) return { kind: 'spotify_play' }

  return null
}

export function describeSpotifyIntent(intent: SpotifyIntent): string {
  switch (intent.kind) {
    case 'spotify_play':
      return 'Abrindo Spotify…'
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
