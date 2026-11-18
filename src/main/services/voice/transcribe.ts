import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  MAX_AUDIO_BYTES,
  MIN_AUDIO_MS,
  TRANSCRIBE_TIMEOUT_MS,
  WHISPER_BEAM_SIZE,
  WHISPER_INITIAL_PROMPT,
} from './constants'
import { ensureWhisperVoiceAssets } from './download'
import {
  assertPathInsideWhisper,
  binaryPath,
  ensureWhisperDirs,
  isBinaryReady,
  isModelReady,
  modelPath,
  redactPath,
  whisperTempDir,
} from './paths'
import { normalizeWhisperPtBr } from '../../../shared/whisperPtBrNormalize'
import type { VoiceProgress } from '../../../shared/types'
import { decodeWhisperOutputBytes } from './decodeOutput'
import { readSttPreferenceFromEnv } from './sttPreference'
import {
  ensureSherpaAssets,
  ensureSherpaDirs,
  isSherpaReady,
  redactSherpaPath,
  runSherpaOffline,
  sherpaTempDir,
} from './sherpa'

type WavInfo = {
  sampleRate: number
  channels: number
  bitsPerSample: number
  dataBytes: number
  durationMs: number
}

function parseWavHeader(buf: Buffer): WavInfo {
  if (buf.length < 44) {
    throw new Error('AUDIO_INVALID: arquivo de áudio muito pequeno')
  }
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('AUDIO_INVALID: esperava WAV PCM')
  }

  let offset = 12
  let sampleRate = 0
  let channels = 0
  let bitsPerSample = 0
  let dataBytes = 0

  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4)
    const size = buf.readUInt32LE(offset + 4)
    const next = offset + 8 + size
    if (id === 'fmt ') {
      const audioFormat = buf.readUInt16LE(offset + 8)
      channels = buf.readUInt16LE(offset + 10)
      sampleRate = buf.readUInt32LE(offset + 12)
      bitsPerSample = buf.readUInt16LE(offset + 22)
      if (audioFormat !== 1) {
        throw new Error('AUDIO_INVALID: só WAV PCM linear (formato 1)')
      }
    } else if (id === 'data') {
      dataBytes = size
      break
    }
    offset = next + (size % 2) // word align
  }

  if (!sampleRate || !channels || !bitsPerSample || !dataBytes) {
    throw new Error('AUDIO_INVALID: cabeçalho WAV incompleto')
  }

  const bytesPerMs = (sampleRate * channels * (bitsPerSample / 8)) / 1000
  const durationMs = bytesPerMs > 0 ? dataBytes / bytesPerMs : 0

  return { sampleRate, channels, bitsPerSample, dataBytes, durationMs }
}

function decodeBase64Wav(audioBase64: string): Buffer {
  const cleaned = audioBase64.replace(/^data:audio\/wav;base64,/, '')
  let buf: Buffer
  try {
    buf = Buffer.from(cleaned, 'base64')
  } catch {
    throw new Error('AUDIO_INVALID: base64 inválido')
  }
  if (buf.length === 0 || buf.length > MAX_AUDIO_BYTES) {
    throw new Error(
      buf.length === 0
        ? 'AUDIO_TOO_SHORT: áudio vazio'
        : 'AUDIO_INVALID: áudio grande demais para o MVP',
    )
  }
  return buf
}

async function runWhisperCli(wavPath: string, outBase: string): Promise<string> {
  const cli = binaryPath()
  const model = modelPath()
  assertPathInsideWhisper(cli)
  assertPathInsideWhisper(model)
  assertPathInsideWhisper(wavPath)

  const args = [
    '-m',
    model,
    '-f',
    wavPath,
    '-l',
    'pt',
    '--prompt',
    WHISPER_INITIAL_PROMPT,
    '-bs',
    String(WHISPER_BEAM_SIZE),
    '-otxt',
    '-of',
    outBase,
    '-np',
    '-nt',
  ]

  return await new Promise<string>((resolve, reject) => {
    const binDir = dirname(cli)
    const child = spawn(cli, args, {
      shell: false,
      windowsHide: true,
      cwd: binDir,
      env: {
        ...process.env,
        PATH:
          process.platform === 'win32'
            ? `${binDir};${process.env.PATH ?? ''}`
            : process.env.PATH,
      },
    })

    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('TRANSCRIBE_FAILED: tempo esgotado na transcrição'))
    }, TRANSCRIBE_TIMEOUT_MS)

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
      if (stderr.length > 4000) stderr = stderr.slice(-4000)
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      console.error('[elio] voice: spawn falhou', { code: (err as NodeJS.ErrnoException).code })
      reject(new Error('WHISPER_MISSING: não foi possível iniciar o whisper-cli'))
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      const txtPath = `${outBase}.txt`
      const stderrTail = stderr.trim().slice(-500)
      if (code !== 0) {
        console.error('[elio] voice: whisper-cli exit', {
          code,
          stderr: stderrTail || undefined,
        })
        reject(new Error('TRANSCRIBE_FAILED: o Whisper não conseguiu transcrever'))
        return
      }
      if (!existsSync(txtPath)) {
        console.error('[elio] voice: whisper-cli sem .txt', {
          stderr: stderrTail || undefined,
        })
        reject(new Error('TRANSCRIBE_FAILED: saída do Whisper ausente'))
        return
      }
      try {
        const text = decodeWhisperOutputBytes(readFileSync(txtPath))
        resolve(text)
      } catch (readErr) {
        console.error('[elio] voice: leitura .txt falhou', {
          name: readErr instanceof Error ? readErr.name : 'Unknown',
        })
        reject(new Error('TRANSCRIBE_FAILED: não foi possível ler a saída'))
      }
    })
  })
}

function prefersSherpa(): boolean {
  const pref = readSttPreferenceFromEnv()
  return pref === 'auto' || pref === 'sherpa'
}

async function transcribeWithSherpa(
  wav: Buffer,
  onProgress?: (p: VoiceProgress) => void,
): Promise<string> {
  ensureSherpaDirs()
  if (!isSherpaReady()) {
    await ensureSherpaAssets(onProgress)
  }
  if (!isSherpaReady()) {
    throw new Error('SHERPA_MISSING: Sherpa não está instalado')
  }

  const id = randomUUID()
  const wavPath = join(sherpaTempDir(), `${id}.wav`)
  try {
    writeFileSync(wavPath, wav)
    const raw = await runSherpaOffline(wavPath)
    return normalizeWhisperPtBr(raw)
  } finally {
    rmSync(wavPath, { force: true })
  }
}

async function transcribeWithWhisper(
  wav: Buffer,
  onProgress?: (p: VoiceProgress) => void,
): Promise<string> {
  ensureWhisperDirs()

  if (!isBinaryReady() || !isModelReady()) {
    await ensureWhisperVoiceAssets(onProgress)
  }

  if (!isBinaryReady()) {
    throw new Error('WHISPER_MISSING: whisper-cli não está instalado')
  }
  if (!isModelReady()) {
    throw new Error('MODEL_MISSING: modelo Whisper ausente')
  }

  const id = randomUUID()
  const wavPath = join(whisperTempDir(), `${id}.wav`)
  const outBase = join(whisperTempDir(), id)
  const txtPath = `${outBase}.txt`

  try {
    writeFileSync(wavPath, wav)
    const raw = await runWhisperCli(wavPath, outBase)
    return normalizeWhisperPtBr(raw)
  } finally {
    rmSync(wavPath, { force: true })
    rmSync(txtPath, { force: true })
  }
}

export async function transcribeWavBase64(
  audioBase64: string,
  onProgress?: (p: VoiceProgress) => void,
): Promise<{ text: string }> {
  const wav = decodeBase64Wav(audioBase64)
  const info = parseWavHeader(wav)
  if (info.durationMs < MIN_AUDIO_MS) {
    throw new Error('AUDIO_TOO_SHORT: fale um pouco mais (áudio muito curto)')
  }

  const forceWhisper = readSttPreferenceFromEnv() === 'whisper'

  try {
    let text: string
    if (!forceWhisper && prefersSherpa()) {
      try {
        text = await transcribeWithSherpa(wav, onProgress)
      } catch (sherpaErr) {
        console.error('[elio] voice: Sherpa falhou — tentando Whisper', {
          message:
            sherpaErr instanceof Error
              ? sherpaErr.message.slice(0, 200)
              : String(sherpaErr).slice(0, 200),
          tmp: redactSherpaPath(sherpaTempDir()),
        })
        text = await transcribeWithWhisper(wav, onProgress)
      }
    } else {
      text = await transcribeWithWhisper(wav, onProgress)
    }

    if (!text) {
      throw new Error('AUDIO_TOO_SHORT: não deu para entender — tente falar de novo')
    }
    return { text }
  } catch (err) {
    const detail =
      err instanceof Error
        ? { name: err.name, message: err.message.slice(0, 300) }
        : { name: 'Unknown', message: String(err).slice(0, 300) }
    console.error('[elio] voice: transcribe falhou', {
      tmp: redactPath(whisperTempDir()),
      ...detail,
    })
    throw err
  }
}
