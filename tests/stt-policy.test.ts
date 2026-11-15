import { describe, expect, it } from 'vitest'
import {
  parseSttPreference,
  resolveSttBackend,
  shouldFallbackToWhisper,
} from '../src/shared/sttPolicy'

describe('parseSttPreference', () => {
  it('aceita valores conhecidos', () => {
    expect(parseSttPreference('auto')).toBe('auto')
    expect(parseSttPreference('WHISPER')).toBe('whisper')
    expect(parseSttPreference('windows-speech')).toBe('windows-speech')
  })

  it('cai em auto se inválido', () => {
    expect(parseSttPreference('')).toBe('auto')
    expect(parseSttPreference('foo')).toBe('auto')
    expect(parseSttPreference(undefined)).toBe('auto')
  })
})

describe('resolveSttBackend', () => {
  it('no Windows com SpeechRecognition → windows-speech', () => {
    expect(
      resolveSttBackend({
        platform: 'win32',
        speechRecognitionAvailable: true,
        preference: 'auto',
      }),
    ).toBe('windows-speech')
  })

  it('sem SpeechRecognition → whisper', () => {
    expect(
      resolveSttBackend({
        platform: 'win32',
        speechRecognitionAvailable: false,
        preference: 'auto',
      }),
    ).toBe('whisper')
  })

  it('Linux auto → whisper mesmo com SpeechRecognition', () => {
    expect(
      resolveSttBackend({
        platform: 'linux',
        speechRecognitionAvailable: true,
        preference: 'auto',
      }),
    ).toBe('whisper')
  })

  it('force whisper ignora disponibilidade', () => {
    expect(
      resolveSttBackend({
        platform: 'win32',
        speechRecognitionAvailable: true,
        preference: 'whisper',
      }),
    ).toBe('whisper')
  })

  it('force windows-speech sem API → whisper', () => {
    expect(
      resolveSttBackend({
        platform: 'win32',
        speechRecognitionAvailable: false,
        preference: 'windows-speech',
      }),
    ).toBe('whisper')
  })
})

describe('shouldFallbackToWhisper', () => {
  it('não cai no Whisper se permissão negada', () => {
    expect(shouldFallbackToWhisper('not-allowed')).toBe(false)
    expect(shouldFallbackToWhisper('service-not-allowed')).toBe(false)
  })

  it('cai no Whisper em erros recuperáveis / vazio', () => {
    expect(shouldFallbackToWhisper('network')).toBe(true)
    expect(shouldFallbackToWhisper('audio-capture')).toBe(true)
    expect(shouldFallbackToWhisper(null)).toBe(true)
  })
})
