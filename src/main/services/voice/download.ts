import { createWriteStream, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { Readable } from 'node:stream'
import {
  DOWNLOAD_TIMEOUT_MS,
  MODEL_FILE,
  MODEL_SIZE_HINT_MB,
  MODEL_URL,
  WHISPER_RELEASE,
  binaryArchiveUrl,
  binaryFileName,
} from './constants'
import {
  ensureWhisperDirs,
  hasLegacyTinyModel,
  isBinaryReady,
  isModelReady,
  modelPath,
  redactPath,
  whisperBinDir,
  whisperModelDir,
  whisperRoot,
  whisperTempDir,
} from './paths'
import type { VoiceProgress } from '../../../shared/types'

const execFileAsync = promisify(execFile)

export type ProgressEmitter = (progress: VoiceProgress) => void

function emit(
  onProgress: ProgressEmitter | undefined,
  phase: VoiceProgress['phase'],
  percent: number,
  message: string,
): void {
  onProgress?.({ phase, percent: Math.max(0, Math.min(100, percent)), message })
}

async function downloadToFile(
  url: string,
  destPath: string,
  onProgress: ProgressEmitter | undefined,
  phase: VoiceProgress['phase'],
  label: string,
): Promise<void> {
  mkdirSync(dirname(destPath), { recursive: true })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': `Elio/${WHISPER_RELEASE}` },
    })
    if (!response.ok || !response.body) {
      throw new Error(`DOWNLOAD_FAILED: falha ao baixar ${label} (HTTP ${response.status})`)
    }

    const total = Number(response.headers.get('content-length') ?? '0')
    let received = 0
    const file = createWriteStream(destPath)

    const nodeStream = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream)
    nodeStream.on('data', (chunk: Buffer) => {
      received += chunk.length
      if (total > 0) {
        const pct = Math.floor((received / total) * 100)
        emit(onProgress, phase, pct, `${label}: ${pct}%`)
      } else {
        emit(onProgress, phase, 0, `${label}: baixando…`)
      }
    })

    await pipeline(nodeStream, file)
    emit(onProgress, phase, 100, `${label}: concluído`)
  } finally {
    clearTimeout(timer)
  }
}

async function extractArchive(archivePath: string, destDir: string): Promise<void> {
  mkdirSync(destDir, { recursive: true })
  if (archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz')) {
    await execFileAsync('tar', ['-xzf', archivePath, '-C', destDir], { windowsHide: true })
    return
  }
  if (process.platform === 'win32') {
    // Expand-Archive só aceita .zip; paths sob nosso userData controlado.
    await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Expand-Archive -LiteralPath $env:ELIO_ZIP -DestinationPath $env:ELIO_DEST -Force`,
      ],
      {
        env: { ...process.env, ELIO_ZIP: archivePath, ELIO_DEST: destDir },
        windowsHide: true,
      },
    )
    return
  }
  await execFileAsync('unzip', ['-o', archivePath, '-d', destDir], { windowsHide: true })
}

function findBinary(root: string, name: string): string | null {
  const stack = [root]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
      } else if (entry.name === name) {
        return full
      }
    }
  }
  return null
}

async function ensureBinary(onProgress?: ProgressEmitter): Promise<void> {
  if (isBinaryReady()) return

  const url = binaryArchiveUrl(process.platform)
  if (!url) {
    throw new Error('UNSUPPORTED_PLATFORM: voz (Whisper) no MVP é Windows x64 (e Linux x64 em dev)')
  }

  ensureWhisperDirs()
  const archiveName = process.platform === 'win32' ? 'whisper-bin.zip' : 'whisper-bin.tar.gz'
  const archivePath = join(whisperTempDir(), archiveName)
  const extractDir = join(whisperTempDir(), 'extract')

  rmSync(extractDir, { recursive: true, force: true })
  mkdirSync(extractDir, { recursive: true })

  emit(onProgress, 'binary', 0, 'Baixando Whisper (binário)…')
  try {
    await downloadToFile(url, archivePath, onProgress, 'binary', 'Binário Whisper')
    emit(onProgress, 'extract', 10, 'Extraindo Whisper…')
    await extractArchive(archivePath, extractDir)

    const cliName = binaryFileName(process.platform)
    const found = findBinary(extractDir, cliName)
    if (!found) {
      throw new Error('WHISPER_MISSING: binário whisper-cli não encontrado no pacote')
    }

    // Mantém a pasta do CLI (DLLs / .so ao lado).
    const sourceDir = dirname(found)
    rmSync(whisperBinDir(), { recursive: true, force: true })
    mkdirSync(dirname(whisperBinDir()), { recursive: true })
    renameSync(sourceDir, whisperBinDir())

    if (!isBinaryReady()) {
      throw new Error('WHISPER_MISSING: falha ao instalar whisper-cli')
    }
    emit(onProgress, 'binary', 100, 'Binário Whisper pronto')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'DOWNLOAD_FAILED'
    console.error('[elio] voice: download binário falhou', { where: redactPath(whisperRoot()) })
    if (message.startsWith('WHISPER_MISSING') || message.startsWith('UNSUPPORTED')) {
      throw err
    }
    throw new Error(
      message.startsWith('DOWNLOAD_FAILED')
        ? message
        : `DOWNLOAD_FAILED: não foi possível baixar o Whisper (${message})`,
    )
  } finally {
    rmSync(archivePath, { force: true })
    rmSync(extractDir, { recursive: true, force: true })
  }
}

async function ensureModel(onProgress?: ProgressEmitter): Promise<void> {
  if (isModelReady()) return

  ensureWhisperDirs()
  const partial = join(whisperModelDir(), `${MODEL_FILE}.partial`)
  rmSync(partial, { force: true })

  const migrating = hasLegacyTinyModel()
  const startMsg = migrating
    ? `Atualizando modelo de voz (tiny → base, ~${MODEL_SIZE_HINT_MB} MB)…`
    : `Baixando modelo de voz (base, ~${MODEL_SIZE_HINT_MB} MB)…`
  emit(onProgress, 'model', 0, startMsg)
  try {
    await downloadToFile(MODEL_URL, partial, onProgress, 'model', 'Modelo base')
    renameSync(partial, modelPath())
    if (!isModelReady()) {
      throw new Error('MODEL_MISSING: modelo não ficou disponível após o download')
    }
    emit(
      onProgress,
      'model',
      100,
      migrating
        ? 'Modelo base pronto (pode apagar ggml-tiny.bin em whisper\\models)'
        : 'Modelo base pronto',
    )
  } catch (err) {
    rmSync(partial, { force: true })
    console.error('[elio] voice: download modelo falhou', { where: redactPath(whisperModelDir()) })
    const message = err instanceof Error ? err.message : 'DOWNLOAD_FAILED'
    if (message.startsWith('MODEL_MISSING') || message.startsWith('DOWNLOAD_FAILED')) {
      throw err
    }
    throw new Error(`DOWNLOAD_FAILED: não foi possível baixar o modelo (${message})`)
  }
}

export async function ensureVoiceAssets(onProgress?: ProgressEmitter): Promise<{
  binaryReady: boolean
  modelReady: boolean
}> {
  ensureWhisperDirs()
  await ensureBinary(onProgress)
  await ensureModel(onProgress)
  emit(onProgress, 'idle', 100, 'Voz pronta')
  return { binaryReady: isBinaryReady(), modelReady: isModelReady() }
}

export function voiceAssetsStatus(): {
  binaryReady: boolean
  modelReady: boolean
  ready: boolean
} {
  const binaryReady = isBinaryReady()
  const modelReady = isModelReady()
  return { binaryReady, modelReady, ready: binaryReady && modelReady }
}
