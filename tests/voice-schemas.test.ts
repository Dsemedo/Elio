import { describe, expect, it } from 'vitest'
import {
  IpcChannels,
  VoiceProgressSchema,
  VoiceStatusSchema,
  VoiceTranscribeInputSchema,
} from '../src/shared/ipc'
import { friendlyVoiceError } from '../src/main/services/voice/errors'

describe('voice IPC contracts', () => {
  it('expõe canais de voz fixos', () => {
    expect(IpcChannels.VOICE_GET_STATUS).toBe('voice:getStatus')
    expect(IpcChannels.VOICE_ENSURE).toBe('voice:ensure')
    expect(IpcChannels.VOICE_TRANSCRIBE).toBe('voice:transcribe')
    expect(IpcChannels.VOICE_PROGRESS).toBe('voice:progress')
  })

  it('valida status de voz', () => {
    const status = VoiceStatusSchema.parse({
      ready: false,
      binaryReady: false,
      modelReady: false,
      modelId: 'small',
      whisperVersion: 'v1.9.2',
      supported: true,
      hint: 'baixar',
    })
    expect(status.modelId).toBe('small')
  })

  it('expõe canais de localização', () => {
    expect(IpcChannels.LOCATION_GET).toBe('location:get')
    expect(IpcChannels.LOCATION_SAVE_OS).toBe('location:saveOs')
    expect(IpcChannels.LOCATION_ENSURE_IP_FALLBACK).toBe('location:ensureIpFallback')
  })

  it('valida progresso', () => {
    const progress = VoiceProgressSchema.parse({
      phase: 'model',
      percent: 42,
      message: 'baixando',
    })
    expect(progress.percent).toBe(42)
  })

  it('rejeita payload de transcrição vazio', () => {
    expect(() => VoiceTranscribeInputSchema.parse({ audioBase64: '' })).toThrow()
  })

  it('mapeia erros de voz para mensagens amigáveis', () => {
    expect(friendlyVoiceError('AUDIO_TOO_SHORT: x')).toMatch(/curto/i)
    expect(friendlyVoiceError('WHISPER_MISSING: x')).toMatch(/Whisper/i)
    expect(friendlyVoiceError('DOWNLOAD_FAILED: x')).toMatch(/download/i)
    expect(friendlyVoiceError('EXTRACT_FAILED: x')).toMatch(/extrair/i)
    expect(friendlyVoiceError('algo-interno-com-path')).toMatch(/digitar/i)
  })
})
