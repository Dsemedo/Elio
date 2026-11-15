import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { app } from 'electron'
import { LEGACY_MODEL_FILE, MODEL_FILE, binaryFileName } from './constants'

/**
 * Tudo sob userData (OD-18). Paths nunca são expostos ao renderer.
 */
export function whisperRoot(): string {
  return join(app.getPath('userData'), 'whisper')
}

export function whisperBinDir(): string {
  return join(whisperRoot(), 'bin')
}

export function whisperModelDir(): string {
  return join(whisperRoot(), 'models')
}

export function whisperTempDir(): string {
  return join(whisperRoot(), 'tmp')
}

export function modelPath(): string {
  return join(whisperModelDir(), MODEL_FILE)
}

/** Modelo tiny antigo — só para UX de migração; não é usado na transcrição. */
export function legacyModelPath(): string {
  return join(whisperModelDir(), LEGACY_MODEL_FILE)
}

export function hasLegacyTinyModel(): boolean {
  return existsSync(legacyModelPath())
}

export function binaryPath(): string {
  return join(whisperBinDir(), binaryFileName(process.platform))
}

export function ensureWhisperDirs(): void {
  for (const dir of [whisperRoot(), whisperBinDir(), whisperModelDir(), whisperTempDir()]) {
    mkdirSync(dir, { recursive: true })
  }
}

export function isBinaryReady(): boolean {
  return existsSync(binaryPath())
}

export function isModelReady(): boolean {
  return existsSync(modelPath())
}

/** Redige o prefixo de userData em logs. */
export function redactPath(path: string): string {
  const root = app.getPath('userData')
  if (path.startsWith(root)) {
    return `<userData>${path.slice(root.length)}`
  }
  return '<path>'
}

export function assertPathInsideWhisper(candidate: string): void {
  const root = resolve(whisperRoot())
  const resolved = resolve(candidate)
  const prefix = root.endsWith(sep) ? root : root + sep
  if (resolved !== root && !resolved.startsWith(prefix)) {
    throw new Error('Path não autorizado')
  }
  if (!existsSync(resolved)) {
    throw new Error('Arquivo ausente')
  }
}
