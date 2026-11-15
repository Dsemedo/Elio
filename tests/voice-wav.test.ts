import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Testa o parser WAV sem subir Electron: reimplementação espelhada da lógica
 * crítica (duração / RIFF) via fixture gerada inline.
 */
function buildSilentWav(durationMs: number, sampleRate = 16_000): Buffer {
  const samples = Math.floor((sampleRate * durationMs) / 1000)
  const dataBytes = samples * 2
  const buffer = Buffer.alloc(44 + dataBytes)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataBytes, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataBytes, 40)
  return buffer
}

function parseWavHeader(buf: Buffer): { durationMs: number; sampleRate: number } {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('AUDIO_INVALID')
  }
  let offset = 12
  let sampleRate = 0
  let channels = 0
  let bitsPerSample = 0
  let dataBytes = 0
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4)
    const size = buf.readUInt32LE(offset + 4)
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(offset + 10)
      sampleRate = buf.readUInt32LE(offset + 12)
      bitsPerSample = buf.readUInt16LE(offset + 22)
    } else if (id === 'data') {
      dataBytes = size
      break
    }
    offset = offset + 8 + size + (size % 2)
  }
  const bytesPerMs = (sampleRate * channels * (bitsPerSample / 8)) / 1000
  return { sampleRate, durationMs: dataBytes / bytesPerMs }
}

describe('WAV PCM para Whisper', () => {
  it('estima duração de áudio curto vs ok', () => {
    const short = parseWavHeader(buildSilentWav(200))
    const ok = parseWavHeader(buildSilentWav(800))
    expect(short.durationMs).toBeLessThan(400)
    expect(ok.durationMs).toBeGreaterThanOrEqual(400)
    expect(ok.sampleRate).toBe(16_000)
  })

  it('rejeita lixo que não é RIFF/WAVE', () => {
    expect(() => parseWavHeader(Buffer.from('not-a-wav-file-at-all!!!!'))).toThrow(
      /AUDIO_INVALID/,
    )
  })

  it('fixture de constantes de voz está pinada', () => {
    const src = readFileSync(
      join(__dirname, '../src/main/services/voice/constants.ts'),
      'utf8',
    )
    expect(src).toContain("WHISPER_RELEASE = 'v1.9.2'")
    expect(src).toContain("MODEL_ID = 'base'")
    expect(src).toContain("MODEL_FILE = 'ggml-base.bin'")
    expect(src).toContain("LEGACY_MODEL_FILE = 'ggml-tiny.bin'")
  })
})
