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
  DOWNLOAD_MAX_ATTEMPTS,
  DOWNLOAD_RETRY_DELAY_MS,
  DOWNLOAD_TIMEOUT_MS,
} from '../constants'
import { hasVoiceErrorPrefix, logVoiceError, normalizeVoiceEnsureError } from '../errors'
import type { VoiceProgress } from '../../../../shared/types'
import {
  SHERPA_BINARY_ARCHIVE_MIN_BYTES,
  SHERPA_MODEL_ARCHIVE_MIN_BYTES,
  SHERPA_MODEL_FILE,
  SHERPA_MODEL_FILE_MIN_BYTES,
  SHERPA_MODEL_SIZE_HINT_MB,
  SHERPA_MODEL_URL,
  SHERPA_RELEASE,
  SHERPA_TOKENS_FILE,
  sherpaBinaryArchiveUrl,
  sherpaOfflineCliName,
} from './constants'
import {
  ensureSherpaDirs,
  isSherpaBinaryReady,
  isSherpaModelReady,
  redactSherpaPath,
  sherpaBinDir,
  sherpaLibDir,
  sherpaModelDir,
  sherpaModelPath,
  sherpaRoot,
  sherpaTempDir,
  sherpaTokensPath,
} from './paths'

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
    if (isLockError(err)) return
    logVoiceError('sherpa: limpeza temporária falhou (ignorada)', err, {
      where: redactSherpaPath(path),
    })
  }
}

function uniqueDownloadPath(prefix: string, attempt = 1): string {
  return join(
    sherpaTempDir(),
    `${prefix}-${process.pid}-${Date.now()}-a${attempt}-${randomBytes(4).toString('hex')}.part`,
  )
}

function assertMinFileSize(path: string, minBytes: number, label: string): void {
  let size = 0
  try {
    size = statSync(path).size
  } catch (err) {
    logVoiceError('sherpa: arquivo baixado ausente', err, { label })
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
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': `Elio/sherpa-${SHERPA_RELEASE}`,
        Accept: 'application/octet-stream,*/*',
      },
    })
    if (!response.ok || !response.body) {
      throw new Error(`DOWNLOAD_FAILED: falha ao baixar ${label} (HTTP ${response.status})`)
    }

    const total = Number(response.headers.get('content-length') ?? '0')
    let received = 0
    const file = createWriteStream(destPath, { flags: 'wx' })
    const nodeStream = Readable.fromWeb(
      response.body as import('node:stream/web').ReadableStream,
    )
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
        await sleep(DOWNLOAD_RETRY_DELAY_MS * attempt)
      }
      await downloadToFileOnce(url, destPath, onProgress, phase, label)
      return destPath
    } catch (err) {
      lastErr = err
      safeRm(destPath)
      logVoiceError('sherpa: tentativa de download falhou', err, {
        label,
        attempt,
        where: redactSherpaPath(destPath),
      })
      const message = err instanceof Error ? err.message : ''
      if (/HTTP 404|HTTP 403|UNSUPPORTED/i.test(message)) break
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`DOWNLOAD_FAILED: não foi possível baixar ${label}`)
}

async function extractTarBz2(archivePath: string, destDir: string): Promise<void> {
  mkdirSync(destDir, { recursive: true })
  await execFileAsync('tar', ['-xjf', archivePath, '-C', destDir], { windowsHide: true })
}

function findNamedFile(root: string, name: string): string | null {
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
      if (entry.isDirectory()) stack.push(full)
      else if (entry.name === name) return full
    }
  }
  return null
}

function installDir(sourceDir: string, destDir: string, label: string): void {
  safeRm(destDir, true)
  mkdirSync(dirname(destDir), { recursive: true })
  try {
    renameSync(sourceDir, destDir)
    return
  } catch {
    // fallback copy
  }
  try {
    cpSync(sourceDir, destDir, { recursive: true })
    safeRm(sourceDir, true)
  } catch (err) {
    logVoiceError('sherpa: instalação falhou', err, { where: redactSherpaPath(destDir) })
    throw new Error(`INSTALL_FAILED: não foi possível instalar ${label}`)
  }
}

async function ensureSherpaBinary(onProgress?: ProgressEmitter): Promise<void> {
  if (isSherpaBinaryReady()) return

  const url = sherpaBinaryArchiveUrl(process.platform)
  if (!url) {
    throw new Error(
      'UNSUPPORTED_PLATFORM: Sherpa STT no MVP é Windows x64 (e Linux x64 em dev)',
    )
  }

  ensureSherpaDirs()
  const extractDir = join(sherpaTempDir(), `extract-bin-${process.pid}-${Date.now()}`)
  mkdirSync(extractDir, { recursive: true })
  let archivePath: string | null = null

  emit(onProgress, 'binary', 0, 'Baixando Sherpa (binário)…')
  try {
    archivePath = await downloadToUniqueTemp(
      url,
      'sherpa-bin',
      onProgress,
      'binary',
      'Binário Sherpa',
    )
    assertMinFileSize(archivePath, SHERPA_BINARY_ARCHIVE_MIN_BYTES, 'binário Sherpa')

    emit(onProgress, 'extract', 10, 'Extraindo Sherpa…')
    await extractTarBz2(archivePath, extractDir)

    const cliName = sherpaOfflineCliName(process.platform)
    const found = findNamedFile(extractDir, cliName)
    if (!found) {
      throw new Error('SHERPA_MISSING: sherpa-onnx-offline não encontrado no pacote')
    }

    const packageBin = dirname(found)
    installDir(packageBin, sherpaBinDir(), 'binário Sherpa')

    // Linux: libs ficam em ../lib — copiar para sherpa/lib
    const packageRoot = dirname(packageBin)
    const packageLib = join(packageRoot, 'lib')
    try {
      const libs = readdirSync(packageLib)
      mkdirSync(sherpaLibDir(), { recursive: true })
      for (const name of libs) {
        if (name.endsWith('.lib')) continue
        try {
          copyFileSync(join(packageLib, name), join(sherpaLibDir(), name))
        } catch {
          // ignore individual
        }
      }
    } catch {
      // Windows já traz DLLs no bin/
    }

    // Windows: também copiar DLLs de lib/ para bin/ se existirem
    if (process.platform === 'win32') {
      try {
        const packageLib = join(dirname(packageBin), 'lib')
        for (const name of readdirSync(packageLib)) {
          if (!/\.dll$/i.test(name)) continue
          copyFileSync(join(packageLib, name), join(sherpaBinDir(), name))
        }
      } catch {
        // ok
      }
    }

    if (!isSherpaBinaryReady()) {
      throw new Error('SHERPA_MISSING: falha ao instalar sherpa-onnx-offline')
    }
    emit(onProgress, 'binary', 100, 'Binário Sherpa pronto')
  } catch (err) {
    logVoiceError('sherpa: download/install binário falhou', err, {
      where: redactSherpaPath(sherpaRoot()),
    })
    const message = err instanceof Error ? err.message : 'DOWNLOAD_FAILED'
    if (hasVoiceErrorPrefix(message)) throw err
    throw new Error(`DOWNLOAD_FAILED: não foi possível baixar o Sherpa (${message})`)
  } finally {
    if (archivePath) safeRm(archivePath)
    safeRm(extractDir, true)
  }
}

async function ensureSherpaModel(onProgress?: ProgressEmitter): Promise<void> {
  if (isSherpaModelReady()) return

  ensureSherpaDirs()
  const extractDir = join(sherpaTempDir(), `extract-model-${process.pid}-${Date.now()}`)
  mkdirSync(extractDir, { recursive: true })
  let archivePath: string | null = null

  emit(
    onProgress,
    'model',
    0,
    `Baixando modelo Sherpa pt-BR (~${SHERPA_MODEL_SIZE_HINT_MB} MB)…`,
  )

  try {
    archivePath = await downloadToUniqueTemp(
      SHERPA_MODEL_URL,
      'sherpa-model',
      onProgress,
      'model',
      'Modelo Sherpa pt-BR',
    )
    assertMinFileSize(archivePath, SHERPA_MODEL_ARCHIVE_MIN_BYTES, 'modelo Sherpa')

    emit(onProgress, 'extract', 40, 'Extraindo modelo Sherpa…')
    await extractTarBz2(archivePath, extractDir)

    const modelFile = findNamedFile(extractDir, SHERPA_MODEL_FILE)
    const tokensFile = findNamedFile(extractDir, SHERPA_TOKENS_FILE)
    if (!modelFile || !tokensFile) {
      throw new Error('MODEL_MISSING: arquivos do modelo Sherpa ausentes no pacote')
    }

    assertMinFileSize(modelFile, SHERPA_MODEL_FILE_MIN_BYTES, 'modelo Sherpa onnx')
    mkdirSync(sherpaModelDir(), { recursive: true })
    safeRm(sherpaModelPath())
    safeRm(sherpaTokensPath())
    try {
      renameSync(modelFile, sherpaModelPath())
      renameSync(tokensFile, sherpaTokensPath())
    } catch {
      copyFileSync(modelFile, sherpaModelPath())
      copyFileSync(tokensFile, sherpaTokensPath())
    }

    if (!isSherpaModelReady()) {
      throw new Error('MODEL_MISSING: modelo Sherpa não ficou disponível')
    }
    emit(onProgress, 'model', 100, 'Modelo Sherpa pt-BR pronto')
  } catch (err) {
    logVoiceError('sherpa: download modelo falhou', err, {
      where: redactSherpaPath(sherpaModelDir()),
    })
    const message = err instanceof Error ? err.message : 'DOWNLOAD_FAILED'
    if (hasVoiceErrorPrefix(message)) throw err
    throw new Error(`DOWNLOAD_FAILED: não foi possível baixar o modelo Sherpa (${message})`)
  } finally {
    if (archivePath) safeRm(archivePath)
    safeRm(extractDir, true)
  }
}

export async function ensureSherpaAssets(onProgress?: ProgressEmitter): Promise<{
  binaryReady: boolean
  modelReady: boolean
}> {
  try {
    ensureSherpaDirs()
    await ensureSherpaBinary(onProgress)
    await ensureSherpaModel(onProgress)
    emit(onProgress, 'idle', 100, 'Voz Sherpa pronta')
    return {
      binaryReady: isSherpaBinaryReady(),
      modelReady: isSherpaModelReady(),
    }
  } catch (err) {
    throw normalizeVoiceEnsureError(err)
  }
}

export function sherpaAssetsStatus(): {
  binaryReady: boolean
  modelReady: boolean
  ready: boolean
} {
  const binaryReady = isSherpaBinaryReady()
  const modelReady = isSherpaModelReady()
  return { binaryReady, modelReady, ready: binaryReady && modelReady }
}
