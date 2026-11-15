import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { app } from 'electron'
import { LEGACY_MODEL_FILES, binaryFileName, resolveWhisperModel } from './constants'

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
  const { file } = resolveWhisperModel()
  return join(whisperModelDir(), file)
}

/** Modelos antigos no disco — só UX de migração; não usados na transcrição. */
export function listLegacyModelFilesOnDisk(): string[] {
  const dir = whisperModelDir()
  if (!existsSync(dir)) return []
  const current = resolveWhisperModel().file
  const found: string[] = []
  try {
    for (const name of readdirSync(dir)) {
      if (name === current) continue
      if (
        (LEGACY_MODEL_FILES as readonly string[]).includes(name) ||
        /^ggml-.+\.bin$/i.test(name)
      ) {
        found.push(name)
      }
    }
  } catch {
    return []
  }
  return found
}

export function hasLegacyModels(): boolean {
  return listLegacyModelFilesOnDisk().length > 0
}

/** @deprecated use hasLegacyModels — mantido p/ imports antigos em testes. */
export function hasLegacyTinyModel(): boolean {
  return existsSync(join(whisperModelDir(), 'ggml-tiny.bin'))
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
