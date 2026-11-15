/**
 * Allowlist estreita para abrir Spotify via shell.openExternal.
 * Aceita https://open.spotify.com… e spotify: (URI do app).
 */

export const SPOTIFY_OPEN_HTTPS = 'https://open.spotify.com'
export const SPOTIFY_APP_URI = 'spotify:'

export type SpotifyUrlValidation =
  | { ok: true; url: string }
  | { ok: false; reason: string }

const SPOTIFY_URI_RE =
  /^spotify:(?:$|open:?$|track:[a-zA-Z0-9]+|album:[a-zA-Z0-9]+|playlist:[a-zA-Z0-9]+|artist:[a-zA-Z0-9]+|user:[a-zA-Z0-9._-]+(?::playlist:[a-zA-Z0-9]+)?|search:.+)$/i

/**
 * Valida alvo externo do Spotify (https open.spotify.com ou URI spotify:).
 */
export function validateSpotifyExternalUrl(raw: string): SpotifyUrlValidation {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, reason: 'URL Spotify vazia' }

  if (/^spotify:/i.test(trimmed)) {
    if (!SPOTIFY_URI_RE.test(trimmed)) {
      return { ok: false, reason: 'URI spotify: não permitida' }
    }
    return { ok: true, url: trimmed }
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, reason: 'URL Spotify inválida' }
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Só https ou spotify: são permitidos' }
  }

  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'URL com credenciais não é permitida' }
  }

  const host = parsed.hostname.toLowerCase()
  if (host !== 'open.spotify.com' && host !== 'www.open.spotify.com') {
    return { ok: false, reason: 'Host Spotify não allowlisted' }
  }

  return { ok: true, url: parsed.toString() }
}

/** Alvos padrão para abrir o app / web player. */
export function defaultSpotifyOpenTargets(): { appUri: string; https: string } {
  return { appUri: SPOTIFY_APP_URI, https: SPOTIFY_OPEN_HTTPS }
}
