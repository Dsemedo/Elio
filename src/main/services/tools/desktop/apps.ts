import { join } from 'node:path'
import { access } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'

/**
 * Apps comuns via caminhos fixos / openPath — sem shell arbitrário.
 * Windows-first; em outros OS devolve null (CI Linux).
 */

export type AppId =
  | 'notepad'
  | 'calculator'
  | 'explorer'
  | 'paint'
  | 'browser'
  | 'chrome'
  | 'edge'

/** Browsers que aceitam URL https allowlisted como argumento. */
export type BrowserAppId = 'chrome' | 'edge'

const APP_ALIASES: Record<string, AppId> = {
  notepad: 'notepad',
  blocodenotas: 'notepad',
  bloco: 'notepad',
  calculadora: 'calculator',
  calculator: 'calculator',
  calc: 'calculator',
  explorer: 'explorer',
  explorador: 'explorer',
  fileexplorer: 'explorer',
  paint: 'paint',
  mspaint: 'paint',
  browser: 'browser',
  navegador: 'browser',
  chrome: 'chrome',
  googlechrome: 'chrome',
  edge: 'edge',
  microsoftedge: 'edge',
  msedge: 'edge',
}

export function normalizeAppKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

export function resolveAppId(raw: string): AppId | null {
  const key = normalizeAppKey(raw)
  return APP_ALIASES[key] ?? null
}

export function resolveBrowserAppId(raw: string): BrowserAppId | null {
  const id = resolveAppId(raw)
  if (id === 'chrome' || id === 'edge') return id
  return null
}

/**
 * Caminho “canônico” allowlisted (primeiro candidato).
 * Para chrome/edge, use `resolveExistingAppPath` na execução.
 */
export function resolveAppPath(
  appId: AppId,
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (platform !== 'win32') {
    if (appId === 'explorer') return null
    return null
  }

  const systemRoot = env['SystemRoot'] || env['WINDIR'] || 'C:\\Windows'
  const system32 = join(systemRoot, 'System32')
  const programFiles = env['ProgramFiles'] || 'C:\\Program Files'

  switch (appId) {
    case 'notepad':
      return join(system32, 'notepad.exe')
    case 'calculator':
      return join(system32, 'calc.exe')
    case 'paint':
      return join(system32, 'mspaint.exe')
    case 'explorer':
      return join(systemRoot, 'explorer.exe')
    case 'chrome':
      return join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe')
    case 'edge':
      return join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    case 'browser':
      return null
    default:
      return null
  }
}

/** Candidatos allowlisted (ordem de preferência) para achar o exe instalado. */
export function browserPathCandidates(
  browserId: BrowserAppId,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const programFiles = env['ProgramFiles'] || 'C:\\Program Files'
  const programFilesX86 =
    env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  const localAppData = env['LOCALAPPDATA'] || ''

  if (browserId === 'chrome') {
    const list = [
      join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ]
    if (localAppData) {
      list.push(
        join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      )
    }
    return list
  }

  return [
    join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ]
}

export async function resolveExistingAppPath(
  appId: AppId,
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | null> {
  if (platform !== 'win32') return null

  if (appId === 'chrome' || appId === 'edge') {
    for (const path of browserPathCandidates(appId, env)) {
      try {
        await access(path, fsConstants.F_OK)
        return path
      } catch {
        /* next */
      }
    }
    return null
  }

  const path = resolveAppPath(appId, platform, env)
  if (!path) return null
  try {
    await access(path, fsConstants.F_OK)
    return path
  } catch {
    return null
  }
}

export function listKnownApps(): string[] {
  return [...new Set(Object.keys(APP_ALIASES))].sort()
}
