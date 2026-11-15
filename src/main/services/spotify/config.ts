/** Config pública do cliente Spotify (PKCE — sem secret). */

export const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize'
export const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
export const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

/** Loopback fixo — Douglas registra o mesmo URI no Dashboard. */
export const SPOTIFY_REDIRECT_URI = 'http://127.0.0.1:47821/callback'
export const SPOTIFY_LOOPBACK_PORT = 47821

/** Escopos mínimos para retomar / tocar recente. */
export const SPOTIFY_SCOPES = [
  'user-modify-playback-state',
  'user-read-playback-state',
  'user-read-recently-played',
].join(' ')

export function getSpotifyClientId(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const id = env['ELIO_SPOTIFY_CLIENT_ID']?.trim()
  return id || null
}

export function isSpotifyClientConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(getSpotifyClientId(env))
}
