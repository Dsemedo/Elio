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
import { randomBytes } from 'node:crypto'
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

function isLockError(err: unknown): boolean {
  const code = err instanceof Error ? (err as NodeJS.ErrnoException).code : undefined
  return code === 'EPERM' || code === 'EACCES' || code === 'EBUSY'
}

function safeRm(path: string, recursive = false): void {
  try {
    rmSync(path, { recursive, force: true })
  } catch (err) {
    // Windows/Defender: EPERM/EBUSY é esperado em .partial/.exe — não poluir o log.
    if (isLockError(err)) return
    logVoiceError('voice: limpeza temporária falhou (ignorada)', err, {
      where: redactPath(path),
    })
  }
}

/** Nome de arquivo único (sem path) — evita reabrir .partial travado pelo Defender. */
export function buildUniquePartName(
  prefix: string,
  attempt: number,
  pid: number,
  now: number,
  id: string,
): string {
  return `${prefix}-${pid}-${now}-a${attempt}-${id}.part`
}

function uniqueDownloadPath(prefix: string, attempt = 1): string {
  return join(
    whisperTempDir(),
    buildUniquePartName(
      prefix,
      attempt,
      process.pid,
      Date.now(),
      randomBytes(4).toString('hex'),
    ),
  )
}

/** Remove leftovers de tentativas antigas (best-effort). */
function sweepStaleDownloadParts(): void {
  for (const dir of [whisperTempDir(), whisperModelDir()]) {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      continue
    }
    for (const name of entries) {
      if (
        name.endsWith('.part') ||
        name.endsWith('.partial') ||
        name === 'whisper-bin.zip' ||
        name === 'whisper-bin.tar.gz'
      ) {
        safeRm(join(dir, name))
      }
    }
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

function asInstallLockError(_err: unknown, label: string): Error {
  return new Error(
    `INSTALL_FAILED: Windows bloqueou a gravação de ${label} (antivírus/arquivo em uso). Feche outras janelas do Elio e tente de novo.`,
  )
}

async function downloadToFileOnce(
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

    let file
    try {
      // 'wx' = cria arquivo novo; nunca reabre path travado de tentativa anterior.
      file = createWriteStream(destPath, { flags: 'wx' })
    } catch (openErr) {
      if (isLockError(openErr)) {
        throw asInstallLockError(openErr, label)
      }
      throw openErr
    }

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

    try {
      await pipeline(nodeStream, file)
    } catch (pipeErr) {
      if (isLockError(pipeErr)) {
        throw asInstallLockError(pipeErr, label)
      }
      throw pipeErr
    }
    emit(onProgress, phase, 100, `${label}: concluído`)
  } catch (err) {
    safeRm(destPath)
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Baixa para um path único em tmp a cada tentativa (Windows: evita EPERM em .partial fixo).
 * Devolve o path do arquivo completo.
 */
async function downloadToUniqueTemp(
  url: string,
  prefix: string,
  onProgress: ProgressEmitter | undefined,
  phase: VoiceProgress['phase'],
  label: string,
): Promise<string> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= DOWNLOAD_MAX_ATTEMPTS; attempt++) {
    const destPath = uniqueDownloadPath(prefix, attempt)
    try {
      if (attempt > 1) {
        emit(
          onProgress,
          phase,
          0,
          `${label}: nova tentativa ${attempt}/${DOWNLOAD_MAX_ATTEMPTS}…`,
        )
        // EPERM/Defender: espera um pouco mais antes de reabrir disco.
        const delay =
          lastErr && isLockError(lastErr)
            ? DOWNLOAD_RETRY_DELAY_MS * attempt * 2
            : DOWNLOAD_RETRY_DELAY_MS * attempt
        await sleep(delay)
      }
      await downloadToFileOnce(url, destPath, onProgress, phase, label)
      return destPath
    } catch (err) {
      lastErr = err
      safeRm(destPath)
      logVoiceError('voice: tentativa de download falhou', err, {
        label,
        attempt,
        maxAttempts: DOWNLOAD_MAX_ATTEMPTS,
        where: redactPath(destPath),
      })
      const message = err instanceof Error ? err.message : ''
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
  safeRm(finalPath)
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
  sweepStaleDownloadParts()
  const extractDir = join(whisperTempDir(), `extract-${process.pid}-${Date.now()}`)
  mkdirSync(extractDir, { recursive: true })

  let archivePath: string | null = null
  emit(onProgress, 'binary', 0, 'Baixando Whisper (binário)…')
  try {
    archivePath = await downloadToUniqueTemp(
      url,
      'whisper-bin',
      onProgress,
      'binary',
      'Binário Whisper',
    )
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
    if (archivePath) safeRm(archivePath)
    safeRm(extractDir, true)
  }
}

async function ensureModel(onProgress?: ProgressEmitter): Promise<void> {
  if (isModelReady()) return

  ensureWhisperDirs()
  sweepStaleDownloadParts()

  const migrating = hasLegacyTinyModel()
  const startMsg = migrating
    ? `Atualizando modelo de voz (tiny → base, ~${MODEL_SIZE_HINT_MB} MB)…`
    : `Baixando modelo de voz (base, ~${MODEL_SIZE_HINT_MB} MB)…`
  emit(onProgress, 'model', 0, startMsg)

  let downloaded: string | null = null
  try {
    downloaded = await downloadToUniqueTemp(
      MODEL_URL,
      MODEL_FILE,
      onProgress,
      'model',
      'Modelo base',
    )
    assertMinFileSize(downloaded, MODEL_MIN_BYTES, 'modelo base')
    installModelFile(downloaded, modelPath())
    downloaded = null
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
    if (downloaded) safeRm(downloaded)
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
