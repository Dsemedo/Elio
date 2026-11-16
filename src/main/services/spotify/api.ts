import {
  SPOTIFY_API_BASE,
  SPOTIFY_TOKEN_URL,
  getSpotifyClientId,
  SPOTIFY_REDIRECT_URI,
} from './config'
import type { SpotifyTokenSet } from './tokens'

export type SpotifyApiErrorCode =
  | 'premium_required'
  | 'no_device'
  | 'unauthorized'
  | 'http_error'
  | 'network'

export class SpotifyApiError extends Error {
  readonly code: SpotifyApiErrorCode
  readonly httpStatus?: number

  constructor(code: SpotifyApiErrorCode, message: string, httpStatus?: number) {
    super(message)
    this.name = 'SpotifyApiError'
    this.code = code
    if (httpStatus !== undefined) this.httpStatus = httpStatus
  }
}

type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope?: string
}

export async function exchangeAuthCode(opts: {
  code: string
  verifier: string
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
}): Promise<SpotifyTokenSet> {
  const clientId = getSpotifyClientId(opts.env)
  if (!clientId) {
    throw new SpotifyApiError('unauthorized', 'ELIO_SPOTIFY_CLIENT_ID não configurado')
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    client_id: clientId,
    code_verifier: opts.verifier,
  })

  const fetchImpl = opts.fetchImpl ?? fetch
  const res = await fetchImpl(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    throw new SpotifyApiError(
      'unauthorized',
      'Falha ao trocar o código OAuth do Spotify',
      res.status,
    )
  }

  const data = (await res.json()) as TokenResponse
  return toTokenSet(data)
}

export async function refreshAccessToken(opts: {
  refreshToken: string
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
}): Promise<SpotifyTokenSet> {
  const clientId = getSpotifyClientId(opts.env)
  if (!clientId) {
    throw new SpotifyApiError('unauthorized', 'ELIO_SPOTIFY_CLIENT_ID não configurado')
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: opts.refreshToken,
    client_id: clientId,
  })

  const fetchImpl = opts.fetchImpl ?? fetch
  const res = await fetchImpl(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    throw new SpotifyApiError(
      'unauthorized',
      'Sessão Spotify expirou — conecte de novo em Integrações',
      res.status,
    )
  }

  const data = (await res.json()) as TokenResponse
  // Spotify pode omitir refresh_token no refresh — reutiliza o anterior.
  if (!data.refresh_token) {
    data.refresh_token = opts.refreshToken
  }
  return toTokenSet(data)
}

function toTokenSet(data: TokenResponse): SpotifyTokenSet {
  if (!data.access_token || !data.refresh_token || !data.expires_in) {
    throw new SpotifyApiError('unauthorized', 'Resposta de token Spotify incompleta')
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    tokenType: data.token_type || 'Bearer',
    scope: data.scope ?? '',
  }
}

async function apiFetch(
  path: string,
  accessToken: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetchImpl(`${SPOTIFY_API_BASE}${path}`, { ...init, headers })
}

export type SpotifyDevice = {
  id: string | null
  is_active: boolean
  name: string
  type: string
}

export async function listDevices(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SpotifyDevice[]> {
  const res = await apiFetch('/me/player/devices', accessToken, { method: 'GET' }, fetchImpl)
  if (res.status === 401) {
    throw new SpotifyApiError('unauthorized', 'Token Spotify inválido', 401)
  }
  if (!res.ok) {
    throw new SpotifyApiError('http_error', `Spotify devices HTTP ${res.status}`, res.status)
  }
  const data = (await res.json()) as { devices?: SpotifyDevice[] }
  return data.devices ?? []
}

export async function startPlayback(
  accessToken: string,
  opts?: {
    deviceId?: string
    uris?: string[]
    fetchImpl?: typeof fetch
  },
): Promise<void> {
  const fetchImpl = opts?.fetchImpl ?? fetch
  const qs = opts?.deviceId
    ? `?device_id=${encodeURIComponent(opts.deviceId)}`
    : ''
  const init: RequestInit = { method: 'PUT' }
  if (opts?.uris && opts.uris.length > 0) {
    init.body = JSON.stringify({ uris: opts.uris })
  }

  const res = await apiFetch(
    `/me/player/play${qs}`,
    accessToken,
    init,
    fetchImpl,
  )

  if (res.status === 204 || res.status === 202) return

  if (res.status === 401) {
    throw new SpotifyApiError('unauthorized', 'Token Spotify inválido', 401)
  }

  if (res.status === 403) {
    let reason = ''
    try {
      const errBody = (await res.json()) as {
        error?: { reason?: string; message?: string }
      }
      reason = errBody.error?.reason ?? errBody.error?.message ?? ''
    } catch {
      // ignore
    }
    if (/PREMIUM_REQUIRED/i.test(reason) || /premium/i.test(reason)) {
      throw new SpotifyApiError(
        'premium_required',
        'Conta Spotify Free: o controle remoto pela API exige Premium. Abri o app para você tocar manualmente.',
        403,
      )
    }
    throw new SpotifyApiError('http_error', 'Spotify recusou o play (403)', 403)
  }

  if (res.status === 404) {
    throw new SpotifyApiError(
      'no_device',
      'Nenhum aparelho Spotify ativo. Abra o Spotify neste PC e tente de novo.',
      404,
    )
  }

  throw new SpotifyApiError('http_error', `Spotify play HTTP ${res.status}`, res.status)
}

export async function firstRecentTrackUri(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const res = await apiFetch(
    '/me/player/recently-played?limit=1',
    accessToken,
    { method: 'GET' },
    fetchImpl,
  )
  if (!res.ok) return null
  const data = (await res.json()) as {
    items?: Array<{ track?: { uri?: string } }>
  }
  return data.items?.[0]?.track?.uri ?? null
}

export type SpotifySearchTrack = {
  uri: string
  name: string
  artists: string
}

/**
 * Busca a primeira faixa pública pelo nome (Search API).
 * Token de usuário autenticado basta para catálogo público.
 */
export async function searchFirstTrack(
  accessToken: string,
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SpotifySearchTrack | null> {
  const q = query.trim()
  if (!q) return null
  const path = `/search?q=${encodeURIComponent(q)}&type=track&limit=1&market=from_token`
  const res = await apiFetch(path, accessToken, { method: 'GET' }, fetchImpl)
  if (res.status === 401) {
    throw new SpotifyApiError('unauthorized', 'Token Spotify inválido', 401)
  }
  if (!res.ok) {
    throw new SpotifyApiError(
      'http_error',
      `Spotify search HTTP ${res.status}`,
      res.status,
    )
  }
  const data = (await res.json()) as {
    tracks?: {
      items?: Array<{
        uri?: string
        name?: string
        artists?: Array<{ name?: string }>
      }>
    }
  }
  const hit = data.tracks?.items?.[0]
  if (!hit?.uri) return null
  const artists = (hit.artists ?? [])
    .map((a) => a.name)
    .filter(Boolean)
    .join(', ')
  return {
    uri: hit.uri,
    name: hit.name ?? q,
    artists,
  }
}
