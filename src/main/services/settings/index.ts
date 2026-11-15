import { app } from 'electron'
import { electronSecretCrypto } from '../spotify'
import type { SecretCrypto } from '../spotify/tokens'
import { readSettingsFile, writeSettingsFile } from './file'
import {
  clearOpenRouterKey,
  hasStoredOpenRouterKey,
  loadOpenRouterKey,
  openRouterKeyPath,
  saveOpenRouterKey,
} from './openrouter-secret'
import {
  DEFAULT_OLLAMA_HOST,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OPENROUTER_MODEL,
  type ElioSettings,
  type SettingsPublic,
} from './types'

export type {
  ElioSettings,
  SettingsPublic,
} from './types'
export {
  DEFAULT_OLLAMA_HOST,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OPENROUTER_MODEL,
} from './types'

/** Cache em memória — evita decrypt a cada request; invalidado em save/clear. */
let openRouterKeyCache: string | null | undefined

function userDataPath(): string {
  return app.getPath('userData')
}

function envOpenRouterKey(): string | undefined {
  const key = process.env['OPENROUTER_API_KEY']?.trim()
  return key || undefined
}

export function readLocalSettings(): ElioSettings {
  return readSettingsFile(userDataPath())
}

export function getOllamaHost(): string {
  const fromEnv = process.env['OLLAMA_HOST']?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  const fromFile = readLocalSettings().ollamaHost?.trim()
  return (fromFile || DEFAULT_OLLAMA_HOST).replace(/\/$/, '')
}

export function getOllamaModel(): string {
  const fromEnv = process.env['OLLAMA_MODEL']?.trim()
  if (fromEnv) return fromEnv
  return readLocalSettings().ollamaModel?.trim() || DEFAULT_OLLAMA_MODEL
}

export function getOpenRouterModel(): string {
  const fromEnv = process.env['OPENROUTER_MODEL']?.trim()
  if (fromEnv) return fromEnv
  return readLocalSettings().openRouterModel?.trim() || DEFAULT_OPENROUTER_MODEL
}

export function getWeatherCityPreference(): string | undefined {
  const fromEnv = process.env['ELIO_WEATHER_CITY']?.trim()
  if (fromEnv) return fromEnv
  const fromFile = readLocalSettings().weatherCity?.trim()
  return fromFile || undefined
}

/** Garante cache carregado; prioridade: env > cofre local. */
export async function resolveOpenRouterApiKey(
  crypto: SecretCrypto = electronSecretCrypto(),
): Promise<string | undefined> {
  const fromEnv = envOpenRouterKey()
  if (fromEnv) return fromEnv

  if (openRouterKeyCache !== undefined) {
    return openRouterKeyCache ?? undefined
  }

  const loaded = await loadOpenRouterKey(crypto, openRouterKeyPath(userDataPath()))
  openRouterKeyCache = loaded
  return loaded ?? undefined
}

export function invalidateOpenRouterKeyCache(): void {
  openRouterKeyCache = undefined
}

export async function getPublicSettings(
  crypto: SecretCrypto = electronSecretCrypto(),
): Promise<SettingsPublic> {
  const fromEnv = Boolean(envOpenRouterKey())
  const fromStore = fromEnv
    ? false
    : await hasStoredOpenRouterKey(crypto, openRouterKeyPath(userDataPath()))

  return {
    ollamaHost: getOllamaHost(),
    ollamaModel: getOllamaModel(),
    openRouterModel: getOpenRouterModel(),
    weatherCity: getWeatherCityPreference() ?? '',
    openRouterKeyConfigured: fromEnv || fromStore,
    openRouterKeySource: fromEnv ? 'env' : fromStore ? 'store' : 'none',
    encryptionAvailable: await crypto.isEncryptionAvailable(),
  }
}

export type SettingsPatch = {
  ollamaHost?: string | undefined
  ollamaModel?: string | undefined
  openRouterModel?: string | undefined
  weatherCity?: string | undefined
}

export function updateLocalSettings(patch: SettingsPatch): ElioSettings {
  const current = readLocalSettings()
  const next: ElioSettings = { ...current }

  if ('ollamaHost' in patch) {
    const v = patch.ollamaHost?.trim()
    if (v) next.ollamaHost = v
    else delete next.ollamaHost
  }
  if ('ollamaModel' in patch) {
    const v = patch.ollamaModel?.trim()
    if (v) next.ollamaModel = v
    else delete next.ollamaModel
  }
  if ('openRouterModel' in patch) {
    const v = patch.openRouterModel?.trim()
    if (v) next.openRouterModel = v
    else delete next.openRouterModel
  }
  if ('weatherCity' in patch) {
    const v = patch.weatherCity?.trim()
    if (v) next.weatherCity = v
    else delete next.weatherCity
  }

  writeSettingsFile(userDataPath(), next)
  return next
}

export async function setOpenRouterApiKey(
  apiKey: string,
  crypto: SecretCrypto = electronSecretCrypto(),
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const result = await saveOpenRouterKey(
    apiKey,
    crypto,
    openRouterKeyPath(userDataPath()),
  )
  if (result.ok) {
    openRouterKeyCache = apiKey.trim()
  }
  return result
}

export async function removeOpenRouterApiKey(): Promise<void> {
  await clearOpenRouterKey(openRouterKeyPath(userDataPath()))
  openRouterKeyCache = null
}
