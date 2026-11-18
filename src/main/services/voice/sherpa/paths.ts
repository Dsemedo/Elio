import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { app } from 'electron'
import {
  SHERPA_MODEL_DIR_NAME,
  SHERPA_MODEL_FILE,
  SHERPA_TOKENS_FILE,
  sherpaOfflineCliName,
} from './constants'

export function sherpaRoot(): string {
  return join(app.getPath('userData'), 'sherpa')
}

export function sherpaBinDir(): string {
  return join(sherpaRoot(), 'bin')
}

export function sherpaLibDir(): string {
  return join(sherpaRoot(), 'lib')
}

export function sherpaModelDir(): string {
  return join(sherpaRoot(), 'models', SHERPA_MODEL_DIR_NAME)
}

export function sherpaTempDir(): string {
  return join(sherpaRoot(), 'tmp')
}

export function sherpaBinaryPath(): string {
  return join(sherpaBinDir(), sherpaOfflineCliName(process.platform))
}

export function sherpaModelPath(): string {
  return join(sherpaModelDir(), SHERPA_MODEL_FILE)
}

export function sherpaTokensPath(): string {
  return join(sherpaModelDir(), SHERPA_TOKENS_FILE)
}

export function ensureSherpaDirs(): void {
  for (const dir of [
    sherpaRoot(),
    sherpaBinDir(),
    sherpaLibDir(),
    sherpaModelDir(),
    sherpaTempDir(),
  ]) {
    mkdirSync(dir, { recursive: true })
  }
}

export function isSherpaBinaryReady(): boolean {
  return existsSync(sherpaBinaryPath())
}

export function isSherpaModelReady(): boolean {
  return existsSync(sherpaModelPath()) && existsSync(sherpaTokensPath())
}

export function isSherpaReady(): boolean {
  return isSherpaBinaryReady() && isSherpaModelReady()
}

export function redactSherpaPath(path: string): string {
  const root = app.getPath('userData')
  if (path.startsWith(root)) {
    return `<userData>${path.slice(root.length)}`
  }
  return '<path>'
}

export function assertPathInsideSherpa(candidate: string): void {
  const root = resolve(sherpaRoot())
  const resolved = resolve(candidate)
  const prefix = root.endsWith(sep) ? root : root + sep
  if (resolved !== root && !resolved.startsWith(prefix)) {
    throw new Error('Path não autorizado')
  }
  if (!existsSync(resolved)) {
    throw new Error('Arquivo ausente')
  }
}
