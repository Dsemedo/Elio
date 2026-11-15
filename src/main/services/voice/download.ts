import {
  copyFileSync,
  createWriteStream,
  cpSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { Readable } from 'node:stream'
import {
  BINARY_ARCHIVE_MIN_BYTES,
  DOWNLOAD_MAX_ATTEMPTS,
  DOWNLOAD_RETRY_DELAY_MS,
  DOWNLOAD_TIMEOUT_MS,
  MODEL_FILE,
  MODEL_MIN_BYTES,
  MODEL_SIZE_HINT_MB,
  MODEL_URL,
  WHISPER_RELEASE,
  binaryArchiveUrl,
  binaryFileName,
} from './constants'
import { hasVoiceErrorPrefix, logVoiceError, normalizeVoiceEnsureError } from './errors'
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function safeRm(path: string, recursive = false): void {
  try {
    rmSync(path, { recursive, force: true })
  } catch (err) {
    // Windows/Defender: não engolir o erro principal por falha de limpeza.
    logVoiceError('voice: limpeza temporária falhou (ignorada)', err, {
      where: redactPath(path),
    })
  }
}

function assertMinFileSize(path: string, minBytes: number, label: string): void {
  let size = 0
  try {
    size = statSync(path).size
  } catch (err) {
    logVoiceError('voice: arquivo baixado ausente', err, { label })
    throw new Error(`DOWNLOAD_FAILED: arquivo ${label} não ficou no disco`)
  }
  if (size < minBytes) {
    throw new Error(
      `DOWNLOAD_FAILED: ${label} veio incompleto (${size} bytes; mínimo ${minBytes})`,
    )
  }
}

async function downloadToFileOnce(
  url: string,
  destPath: string,
  onProgress: ProgressEmitter | undefined,
  phase: VoiceProgress['phase'],
  label: string,
): Promise<void> {
  mkdirSync(dirname(destPath), { recursive: true })
  safeRm(destPath)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': `Elio/${WHISPER_RELEASE}`,
        Accept: 'application/octet-stream,*/*',
      },
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
  } catch (err) {
    safeRm(destPath)
    throw err
  } finally {
    clearTimeout(timer)
  }
}

async function downloadToFile(
  url: string,
  destPath: string,
  onProgress: ProgressEmitter | undefined,
  phase: VoiceProgress['phase'],
  label: string,
): Promise<void> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= DOWNLOAD_MAX_ATTEMPTS; attempt++) {
    try {
      if (attempt > 1) {
        emit(
          onProgress,
          phase,
          0,
          `${label}: nova tentativa ${attempt}/${DOWNLOAD_MAX_ATTEMPTS}…`,
        )
        await sleep(DOWNLOAD_RETRY_DELAY_MS * attempt)
      }
      await downloadToFileOnce(url, destPath, onProgress, phase, label)
      return
    } catch (err) {
      lastErr = err
      logVoiceError('voice: tentativa de download falhou', err, {
        label,
        attempt,
        maxAttempts: DOWNLOAD_MAX_ATTEMPTS,
      })
      const message = err instanceof Error ? err.message : ''
      // Não insiste em HTTP 404 / plataforma — não vai melhorar.
      if (/HTTP 404|HTTP 403|UNSUPPORTED/i.test(message)) {
        break
      }
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`DOWNLOAD_FAILED: não foi possível baixar ${label}`)
}

async function extractWithTar(archivePath: string, destDir: string): Promise<void> {
  await execFileAsync('tar', ['-xf', archivePath, '-C', destDir], { windowsHide: true })
}

async function extractWithPowerShell(archivePath: string, destDir: string): Promise<void> {
  await execFileAsync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      'Expand-Archive -LiteralPath $env:ELIO_ZIP -DestinationPath $env:ELIO_DEST -Force',
    ],
    {
      env: { ...process.env, ELIO_ZIP: archivePath, ELIO_DEST: destDir },
      windowsHide: true,
    },
  )
}

async function extractArchive(archivePath: string, destDir: string): Promise<void> {
  mkdirSync(destDir, { recursive: true })

  if (archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz')) {
    await execFileAsync('tar', ['-xzf', archivePath, '-C', destDir], { windowsHide: true })
    return
  }

  // .zip — no Windows, tar.exe (bsdtar) extrai zip; GNU tar no Linux não.
  if (process.platform === 'win32') {
    try {
      await extractWithTar(archivePath, destDir)
      return
    } catch (tarErr) {
      logVoiceError('voice: extract via tar falhou; tentando PowerShell', tarErr, {
        where: redactPath(destDir),
      })
    }
    try {
      await extractWithPowerShell(archivePath, destDir)
      return
    } catch (psErr) {
      logVoiceError('voice: extract via PowerShell falhou', psErr, {
        where: redactPath(destDir),
      })
      throw new Error(
        'EXTRACT_FAILED: não foi possível extrair o Whisper no Windows (tar/PowerShell)',
      )
    }
  }

  try {
    await execFileAsync('unzip', ['-o', archivePath, '-d', destDir], { windowsHide: true })
  } catch (unzipErr) {
    logVoiceError('voice: extract via unzip falhou', unzipErr, {
      where: redactPath(destDir),
    })
    throw new Error('EXTRACT_FAILED: não foi possível extrair o pacote do Whisper')
  }
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

/** Instala a pasta do CLI (com DLLs). No Windows, rename pode falhar com AV — copia. */
function installBinaryDir(sourceDir: string, destDir: string): void {
  safeRm(destDir, true)
  mkdirSync(dirname(destDir), { recursive: true })

  try {
    renameSync(sourceDir, destDir)
    return
  } catch (renameErr) {
    logVoiceError('voice: rename do binário falhou; copiando', renameErr, {
      where: redactPath(destDir),
    })
  }

  try {
    cpSync(sourceDir, destDir, { recursive: true })
    safeRm(sourceDir, true)
  } catch (copyErr) {
    logVoiceError('voice: cópia do binário falhou', copyErr, {
      where: redactPath(destDir),
    })
    throw new Error(
      'INSTALL_FAILED: não foi possível instalar o whisper-cli (permissão/antivírus)',
    )
  }
}

function installModelFile(partialPath: string, finalPath: string): void {
  try {
    renameSync(partialPath, finalPath)
    return
  } catch (renameErr) {
    logVoiceError('voice: rename do modelo falhou; copiando', renameErr, {
      where: redactPath(finalPath),
    })
  }

  try {
    copyFileSync(partialPath, finalPath)
    safeRm(partialPath)
  } catch (copyErr) {
    logVoiceError('voice: cópia do modelo falhou', copyErr, {
      where: redactPath(finalPath),
    })
    throw new Error(
      'INSTALL_FAILED: não foi possível gravar o modelo de voz (permissão/antivírus)',
    )
  }
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

  safeRm(extractDir, true)
  mkdirSync(extractDir, { recursive: true })

  emit(onProgress, 'binary', 0, 'Baixando Whisper (binário)…')
  try {
    await downloadToFile(url, archivePath, onProgress, 'binary', 'Binário Whisper')
    assertMinFileSize(archivePath, BINARY_ARCHIVE_MIN_BYTES, 'binário Whisper')

    emit(onProgress, 'extract', 10, 'Extraindo Whisper…')
    await extractArchive(archivePath, extractDir)

    const cliName = binaryFileName(process.platform)
    const found = findBinary(extractDir, cliName)
    if (!found) {
      throw new Error('WHISPER_MISSING: binário whisper-cli não encontrado no pacote')
    }

    // Mantém a pasta do CLI (DLLs / .so ao lado).
    installBinaryDir(dirname(found), whisperBinDir())

    if (!isBinaryReady()) {
      throw new Error('WHISPER_MISSING: falha ao instalar whisper-cli')
    }
    emit(onProgress, 'binary', 100, 'Binário Whisper pronto')
  } catch (err) {
    logVoiceError('voice: download/install binário falhou', err, {
      where: redactPath(whisperRoot()),
    })
    const message = err instanceof Error ? err.message : 'DOWNLOAD_FAILED'
    if (hasVoiceErrorPrefix(message)) {
      throw err
    }
    throw new Error(`DOWNLOAD_FAILED: não foi possível baixar o Whisper (${message})`)
  } finally {
    // Nunca deixar limpeza mascarar sucesso/erro principal (comum no Windows).
    safeRm(archivePath)
    safeRm(extractDir, true)
  }
}

async function ensureModel(onProgress?: ProgressEmitter): Promise<void> {
  if (isModelReady()) return

  ensureWhisperDirs()
  const partial = join(whisperModelDir(), `${MODEL_FILE}.partial`)
  safeRm(partial)

  const migrating = hasLegacyTinyModel()
  const startMsg = migrating
    ? `Atualizando modelo de voz (tiny → base, ~${MODEL_SIZE_HINT_MB} MB)…`
    : `Baixando modelo de voz (base, ~${MODEL_SIZE_HINT_MB} MB)…`
  emit(onProgress, 'model', 0, startMsg)
  try {
    await downloadToFile(MODEL_URL, partial, onProgress, 'model', 'Modelo base')
    assertMinFileSize(partial, MODEL_MIN_BYTES, 'modelo base')
    installModelFile(partial, modelPath())
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
    safeRm(partial)
    logVoiceError('voice: download modelo falhou', err, {
      where: redactPath(whisperModelDir()),
    })
    const message = err instanceof Error ? err.message : 'DOWNLOAD_FAILED'
    if (hasVoiceErrorPrefix(message)) {
      throw err
    }
    throw new Error(`DOWNLOAD_FAILED: não foi possível baixar o modelo (${message})`)
  }
}

export async function ensureVoiceAssets(onProgress?: ProgressEmitter): Promise<{
  binaryReady: boolean
  modelReady: boolean
}> {
  try {
    ensureWhisperDirs()
    await ensureBinary(onProgress)
    await ensureModel(onProgress)
    emit(onProgress, 'idle', 100, 'Voz pronta')
    return { binaryReady: isBinaryReady(), modelReady: isModelReady() }
  } catch (err) {
    throw normalizeVoiceEnsureError(err)
  }
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
