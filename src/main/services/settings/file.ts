import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { ElioSettings } from './types'

export function settingsFilePath(userData: string): string {
  return join(userData, 'elio-settings.json')
}

export function readSettingsFile(userData: string): ElioSettings {
  const path = settingsFilePath(userData)
  if (!existsSync(path)) return {}
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const data = raw as Record<string, unknown>
    const out: ElioSettings = {}
    if (typeof data.ollamaHost === 'string') out.ollamaHost = data.ollamaHost
    if (typeof data.ollamaModel === 'string') out.ollamaModel = data.ollamaModel
    if (typeof data.openRouterModel === 'string') {
      out.openRouterModel = data.openRouterModel
    }
    if (typeof data.weatherCity === 'string') out.weatherCity = data.weatherCity
    return out
  } catch {
    return {}
  }
}

export function writeSettingsFile(userData: string, next: ElioSettings): void {
  const path = settingsFilePath(userData)
  mkdirSync(dirname(path), { recursive: true })
  // Nunca gravar chaves/API secrets neste arquivo.
  const safe: ElioSettings = {}
  if (next.ollamaHost?.trim()) safe.ollamaHost = next.ollamaHost.trim()
  if (next.ollamaModel?.trim()) safe.ollamaModel = next.ollamaModel.trim()
  if (next.openRouterModel?.trim()) {
    safe.openRouterModel = next.openRouterModel.trim()
  }
  if (next.weatherCity?.trim()) safe.weatherCity = next.weatherCity.trim()
  writeFileSync(path, JSON.stringify(safe, null, 2), 'utf8')
}
