import {
  SpotifyApiError,
  firstRecentTrackUri,
  listDevices,
  refreshAccessToken,
  searchFirstTrack,
  startPlayback,
} from './api'
import { startSpotifyAuth } from './auth'
import { isSpotifyClientConfigured } from './config'
import type { SpotifyIntent } from './intent'
import { describeSpotifyIntent } from './intent'
import {
  clearSpotifyTokens,
  defaultTokenFilePath,
  isAccessTokenFresh,
  loadSpotifyTokens,
  saveSpotifyTokens,
  type SecretCrypto,
  type SpotifyTokenSet,
  type TokenPaths,
} from './tokens'
import {
  defaultSpotifyOpenTargets,
  validateSpotifyExternalUrl,
} from './urls'

export type SpotifyOpener = {
  openExternal: (url: string) => Promise<void>
}

export type SpotifyActionResult = {
  ok: boolean
  message: string
  /** Status curto para Floating Bar (opcional). */
  statusLine?: string
}

export type SpotifyRuntime = {
  crypto: SecretCrypto
  paths: TokenPaths
  opener: SpotifyOpener
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
  /** Espera após abrir o app antes de retry de devices (ms). */
  deviceWarmupMs?: number
  sleep?: (ms: number) => Promise<void>
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function openSpotifyApp(opener: SpotifyOpener): Promise<{ opened: string; via: string }> {
  const targets = defaultSpotifyOpenTargets()
  const app = validateSpotifyExternalUrl(targets.appUri)
  if (app.ok) {
    try {
      await opener.openExternal(app.url)
      return { opened: app.url, via: 'spotify:' }
    } catch {
      // cai no https
    }
  }
  const web = validateSpotifyExternalUrl(targets.https)
  if (!web.ok) {
    throw new Error(web.reason)
  }
  await opener.openExternal(web.url)
  return { opened: web.url, via: 'https' }
}

async function ensureFreshTokens(
  runtime: SpotifyRuntime,
): Promise<SpotifyTokenSet | null> {
  const existing = await loadSpotifyTokens(runtime.crypto, runtime.paths)
  if (!existing) return null
  if (isAccessTokenFresh(existing)) return existing

  try {
    const refreshOpts: {
      refreshToken: string
      env?: NodeJS.ProcessEnv
      fetchImpl?: typeof fetch
    } = { refreshToken: existing.refreshToken }
    if (runtime.env) refreshOpts.env = runtime.env
    if (runtime.fetchImpl) refreshOpts.fetchImpl = runtime.fetchImpl
    const refreshed = await refreshAccessToken(refreshOpts)
    const saved = await saveSpotifyTokens(refreshed, runtime.crypto, runtime.paths)
    if (!saved.ok) return null
    return refreshed
  } catch {
    await clearSpotifyTokens(runtime.paths)
    return null
  }
}

async function tryRemotePlay(
  tokens: SpotifyTokenSet,
  runtime: SpotifyRuntime,
  query: string | null,
): Promise<SpotifyActionResult> {
  const fetchImpl = runtime.fetchImpl ?? fetch
  const sleep = runtime.sleep ?? defaultSleep
  const warmup = runtime.deviceWarmupMs ?? 2000

  let devices = await listDevices(tokens.accessToken, fetchImpl)
  if (devices.length === 0) {
    await sleep(warmup)
    devices = await listDevices(tokens.accessToken, fetchImpl)
  }

  const active = devices.find((d) => d.is_active) ?? devices[0]
  if (!active?.id && devices.length === 0) {
    return {
      ok: true,
      statusLine: 'Abrindo Spotify…',
      message:
        'Abri o Spotify, mas não há aparelho ativo para controle remoto. Abra o app neste PC (Premium) e peça de novo.',
    }
  }

  // Play por nome: Search → URI → play
  if (query) {
    try {
      const hit = await searchFirstTrack(tokens.accessToken, query, fetchImpl)
      if (!hit) {
        return {
          ok: true,
          statusLine: 'Abrindo Spotify…',
          message: `Abri o Spotify, mas não achei “${query}” na busca. Tente outro nome de faixa.`,
        }
      }
      const playOpts: {
        deviceId?: string
        uris: string[]
        fetchImpl?: typeof fetch
      } = { uris: [hit.uri], fetchImpl }
      if (active?.id) playOpts.deviceId = active.id
      await startPlayback(tokens.accessToken, playOpts)
      const who = hit.artists ? ` — ${hit.artists}` : ''
      return {
        ok: true,
        statusLine: 'Tocando…',
        message: `Estou colocando “${hit.name}”${who} no Spotify.`,
      }
    } catch (err) {
      if (err instanceof SpotifyApiError && err.code === 'premium_required') {
        return { ok: false, statusLine: 'Abrindo Spotify…', message: err.message }
      }
      if (err instanceof SpotifyApiError && err.code === 'no_device') {
        return { ok: true, statusLine: 'Abrindo Spotify…', message: err.message }
      }
      const msg =
        err instanceof SpotifyApiError
          ? err.message
          : 'Abri o Spotify, mas não consegui tocar a faixa pedida.'
      return { ok: true, statusLine: 'Abrindo Spotify…', message: msg }
    }
  }

  try {
    const playOpts: {
      deviceId?: string
      fetchImpl?: typeof fetch
    } = { fetchImpl }
    if (active?.id) playOpts.deviceId = active.id
    await startPlayback(tokens.accessToken, playOpts)
    return {
      ok: true,
      statusLine: 'Tocando…',
      message: 'Tocando no Spotify.',
    }
  } catch (err) {
    if (err instanceof SpotifyApiError && err.code === 'premium_required') {
      return { ok: false, statusLine: 'Abrindo Spotify…', message: err.message }
    }
    if (err instanceof SpotifyApiError && err.code === 'no_device') {
      return { ok: true, statusLine: 'Abrindo Spotify…', message: err.message }
    }
  }

  // Resume vazio falhou — tenta faixa recente.
  try {
    const uri = await firstRecentTrackUri(tokens.accessToken, fetchImpl)
    if (!uri) {
      return {
        ok: true,
        statusLine: 'Abrindo Spotify…',
        message:
          'Abri o Spotify. Não achei faixa recente para tocar por API — escolha uma música no app.',
      }
    }
    const playOpts: {
      deviceId?: string
      uris: string[]
      fetchImpl?: typeof fetch
    } = { uris: [uri], fetchImpl }
    if (active?.id) playOpts.deviceId = active.id
    await startPlayback(tokens.accessToken, playOpts)
    return {
      ok: true,
      statusLine: 'Tocando…',
      message: 'Tocando uma faixa recente no Spotify.',
    }
  } catch (err) {
    if (err instanceof SpotifyApiError && err.code === 'premium_required') {
      return { ok: false, statusLine: 'Abrindo Spotify…', message: err.message }
    }
    const msg =
      err instanceof SpotifyApiError
        ? err.message
        : 'Abri o Spotify, mas não consegui iniciar o play remoto.'
    return { ok: true, statusLine: 'Abrindo Spotify…', message: msg }
  }
}

export async function handleSpotifyIntent(
  intent: SpotifyIntent,
  runtime: SpotifyRuntime,
): Promise<SpotifyActionResult> {
  const opening = describeSpotifyIntent(intent)

  if (intent.kind === 'spotify_disconnect') {
    await clearSpotifyTokens(runtime.paths)
    return { ok: true, message: 'Spotify desconectado neste PC.' }
  }

  if (intent.kind === 'spotify_connect') {
    if (!isSpotifyClientConfigured(runtime.env)) {
      return {
        ok: false,
        message:
          'Para conectar: crie um app em developer.spotify.com, defina ELIO_SPOTIFY_CLIENT_ID, redirect http://127.0.0.1:47821/callback, e reinicie o Elio.',
      }
    }
    const authOpts: {
      env?: NodeJS.ProcessEnv
      opener?: SpotifyOpener
      fetchImpl?: typeof fetch
    } = { opener: runtime.opener }
    if (runtime.env) authOpts.env = runtime.env
    if (runtime.fetchImpl) authOpts.fetchImpl = runtime.fetchImpl
    const auth = await startSpotifyAuth(authOpts)
    if (!auth.ok) {
      return { ok: false, statusLine: opening, message: auth.reason }
    }
    const saved = await saveSpotifyTokens(auth.tokens, runtime.crypto, runtime.paths)
    if (!saved.ok) {
      return { ok: false, message: saved.reason }
    }
    return {
      ok: true,
      statusLine: 'Spotify conectado',
      message:
        'Spotify conectado. Conta Premium + app aberto neste PC permitem “toca uma música no Spotify”.',
    }
  }

  // spotify_play
  const query = intent.kind === 'spotify_play' ? intent.query : null
  let openedVia = ''
  try {
    const opened = await openSpotifyApp(runtime.opener)
    openedVia = opened.via
  } catch {
    return {
      ok: false,
      message: 'Não consegui abrir o Spotify (URI/https allowlisted).',
    }
  }

  if (!isSpotifyClientConfigured(runtime.env)) {
    return {
      ok: true,
      statusLine: opening,
      message: query
        ? `Abri o Spotify (${openedVia}). Para tocar “${query}” por voz: configure ELIO_SPOTIFY_CLIENT_ID, conecte em Integrações (Premium).`
        : `Abri o Spotify (${openedVia}). Para tocar por voz via API: configure ELIO_SPOTIFY_CLIENT_ID, conecte em Integrações (Premium).`,
    }
  }

  const tokens = await ensureFreshTokens(runtime)
  if (!tokens) {
    return {
      ok: true,
      statusLine: opening,
      message:
        'Abri o Spotify. Conecte a conta em Integrações → Conectar Spotify (ou diga “conectar Spotify”) para play remoto — requer Premium.',
    }
  }

  return tryRemotePlay(tokens, runtime, query)
}

export function electronSpotifyPaths(userData: string): TokenPaths {
  return { filePath: defaultTokenFilePath(userData) }
}
