import { join } from 'node:path'

/**
 * Apps comuns via caminhos fixos / openPath — sem shell arbitrário.
 * Windows-first; em outros OS devolve null (CI Linux).
 */

export type AppId = 'notepad' | 'calculator' | 'explorer' | 'paint' | 'browser'

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
  chrome: 'browser',
  edge: 'browser',
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

/**
 * Caminho absoluto allowlisted do executável (ou pasta para explorer).
 * `browser` não tem path — usa openExternal com about:blank ou google.
 */
export function resolveAppPath(
  appId: AppId,
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (platform !== 'win32') {
    // Em não-Windows só explorer→home via openPath no caller; apps nativos = null.
    if (appId === 'explorer') return null
    return null
  }

  const systemRoot = env['SystemRoot'] || env['WINDIR'] || 'C:\\Windows'
  const system32 = join(systemRoot, 'System32')

  switch (appId) {
    case 'notepad':
      return join(system32, 'notepad.exe')
    case 'calculator':
      // Win10/11: calc.exe ainda resolve via System32 shim / App Execution Alias.
      return join(system32, 'calc.exe')
    case 'paint':
      return join(system32, 'mspaint.exe')
    case 'explorer':
      return join(systemRoot, 'explorer.exe')
    case 'browser':
      return null
    default:
      return null
  }
}

export function listKnownApps(): string[] {
  return [...new Set(Object.keys(APP_ALIASES))].sort()
}
