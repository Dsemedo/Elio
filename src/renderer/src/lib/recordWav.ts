/** Grava PCM do microfone e devolve WAV 16 kHz mono 16-bit (base64). */

import { isMicMissingMessage } from '@shared/micMessages'
import { sanitizeVoiceUiError, windowsSpeechUserMessage } from '@shared/sttPolicy'

export { isMicMissingMessage }

const TARGET_RATE = 16_000

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i += 1) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, samples.length * 2, true)

  let offset = 44
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }
  return buffer
}

function downsample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input
  const ratio = fromRate / toRate
  const newLen = Math.floor(input.length / ratio)
  const result = new Float32Array(newLen)
  for (let i = 0; i < newLen; i += 1) {
    const start = Math.floor(i * ratio)
    const end = Math.floor((i + 1) * ratio)
    let sum = 0
    let count = 0
    for (let j = start; j < end && j < input.length; j += 1) {
      sum += input[j] ?? 0
      count += 1
    }
    result[i] = count > 0 ? sum / count : 0
  }
  return result
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunk = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export type MicRecorder = {
  stop: () => Promise<string>
  cancel: () => void
}

export type MicPresence = {
  inputCount: number
  /** true se enumerateDevices listou pelo menos um audioinput */
  listed: boolean
}

/**
 * Rechecagem leve da lista de devices (mau contato / plug intermitente).
 * Não pede permissão — só lê o que o OS já expõe.
 */
export async function probeMicPresence(): Promise<MicPresence> {
  const media = navigator.mediaDevices
  if (!media?.enumerateDevices) {
    return { inputCount: 0, listed: false }
  }
  try {
    const devices = await media.enumerateDevices()
    const inputs = devices.filter((d: MediaDeviceInfo) => d.kind === 'audioinput')
    return { inputCount: inputs.length, listed: inputs.length > 0 }
  } catch {
    return { inputCount: 0, listed: false }
  }
}

/**
 * Pede permissão de mic (prompt do Windows se preciso) e **libera** o device.
 * Necessário antes do Windows Speech: se deixarmos getUserMedia aberto, o
 * Speech Runtime no Electron frequentemente fica sem áudio → “não ouvi nada”.
 */
export async function primeMicPermission(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
    video: false,
  })
  for (const track of stream.getTracks()) {
    track.stop()
  }
}

/**
 * Inicia captura via Web Audio. Chame `stop()` para obter WAV base64.
 * Erros de permissão / device sobem como DOMException / Error.
 */
export async function startMicRecording(): Promise<MicRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
    video: false,
  })

  const audioContext = new AudioContext()
  const source = audioContext.createMediaStreamSource(stream)
  const processor = audioContext.createScriptProcessor(4096, 1, 1)
  const chunks: Float32Array[] = []
  let cancelled = false

  processor.onaudioprocess = (event) => {
    if (cancelled) return
    const input = event.inputBuffer.getChannelData(0)
    chunks.push(new Float32Array(input))
  }

  // Gain 0: ScriptProcessor precisa estar no grafo, sem eco no alto-falante.
  const mute = audioContext.createGain()
  mute.gain.value = 0
  source.connect(processor)
  processor.connect(mute)
  mute.connect(audioContext.destination)

  const cleanup = (): void => {
    cancelled = true
    try {
      processor.disconnect()
      source.disconnect()
    } catch {
      /* ignore */
    }
    for (const track of stream.getTracks()) {
      track.stop()
    }
    void audioContext.close()
  }

  return {
    cancel: cleanup,
    stop: async () => {
      if (cancelled) {
        throw new Error('Gravação cancelada')
      }
      const sampleRate = audioContext.sampleRate
      cleanup()

      let total = 0
      for (const c of chunks) total += c.length
      const merged = new Float32Array(total)
      let offset = 0
      for (const c of chunks) {
        merged.set(c, offset)
        offset += c.length
      }

      const pcm = downsample(merged, sampleRate, TARGET_RATE)
      const wav = encodeWav(pcm, TARGET_RATE)
      return arrayBufferToBase64(wav)
    },
  }
}

/**
 * Mensagem amigável. NotFoundError pode ser lista vazia de verdade
 * (mau contato / mic desconectado) — mensagem clássica permanece válida.
 * Se a lista ainda mostra um input, sugere contato/uso/bloqueio.
 */
export async function micPermissionMessage(err: unknown): Promise<string> {
  if (err instanceof Error && /WINDOWS_SPEECH/i.test(err.message)) {
    return windowsSpeechUserMessage(err)
  }
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return 'Microfone bloqueado — Windows: Privacidade → Microfone (apps de desktop / Elio)'
    }
    if (err.name === 'NotFoundError') {
      const presence = await probeMicPresence()
      if (presence.listed) {
        return 'Microfone listado, mas sem sinal — confira o encaixe / mau contato e tente de novo.'
      }
      return 'Nenhum microfone encontrado. Conecte um mic e tente de novo.'
    }
  }
  const raw = err instanceof Error ? err.message : 'Não foi possível usar o microfone'
  return sanitizeVoiceUiError(raw)
}
