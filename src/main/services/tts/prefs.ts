import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import { z } from 'zod'
import {
  parseTtsEnabled,
  parseTtsPreference,
  type TtsPreference,
} from '../../../shared/ttsPolicy'

/**
 * Preferências de TTS em userData (local-first).
 * Env ELIO_TTS_ENABLED / ELIO_TTS_PROVIDER sobrescrevem só a leitura efetiva
 * quando definidos (útil p/ CI / debug) — o arquivo continua editável pela UI.
 */

export const TtsPrefsFileSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(['auto', 'system', 'edge']),
  /** Voz neural edge-tts (pt-BR). */
  edgeVoice: z.string().min(1).max(80).default('pt-BR-FranciscaNeural'),
  updatedAt: z.string().datetime(),
})

export type TtsPrefsFile = z.infer<typeof TtsPrefsFileSchema>

const DEFAULT_EDGE_VOICE = 'pt-BR-FranciscaNeural'

function prefsPath(): string {
  return join(app.getPath('userData'), 'elio-tts.json')
}

function nowIso(): string {
  return new Date().toISOString()
}

export function defaultTtsPrefs(): TtsPrefsFile {
  return {
    enabled: false,
    provider: 'auto',
    edgeVoice: DEFAULT_EDGE_VOICE,
    updatedAt: nowIso(),
  }
}

export function readTtsPrefsFile(): TtsPrefsFile {
  const path = prefsPath()
  if (!existsSync(path)) return defaultTtsPrefs()
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown
    const parsed = TtsPrefsFileSchema.safeParse(raw)
    return parsed.success ? parsed.data : defaultTtsPrefs()
  } catch {
    return defaultTtsPrefs()
  }
}

export function writeTtsPrefsFile(
  patch: Partial<Pick<TtsPrefsFile, 'enabled' | 'provider' | 'edgeVoice'>>,
): TtsPrefsFile {
  const current = readTtsPrefsFile()
  const next = TtsPrefsFileSchema.parse({
    enabled: patch.enabled ?? current.enabled,
    provider: patch.provider ?? current.provider,
    edgeVoice: patch.edgeVoice ?? current.edgeVoice,
    updatedAt: nowIso(),
  })
  const path = prefsPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(next, null, 2), 'utf8')
  return next
}

/** Preferência efetiva (arquivo + env). */
export function effectiveTtsPreference(): TtsPreference {
  const fromEnv = parseTtsPreference(process.env.ELIO_TTS_PROVIDER)
  if (process.env.ELIO_TTS_PROVIDER?.trim()) return fromEnv
  return readTtsPrefsFile().provider
}

export function effectiveTtsEnabled(): boolean {
  const fromEnv = parseTtsEnabled(process.env.ELIO_TTS_ENABLED)
  if (fromEnv !== null) return fromEnv
  return readTtsPrefsFile().enabled
}

export function effectiveEdgeVoice(): string {
  const fromEnv = process.env.ELIO_TTS_EDGE_VOICE?.trim()
  if (fromEnv) return fromEnv.slice(0, 80)
  return readTtsPrefsFile().edgeVoice || DEFAULT_EDGE_VOICE
}
