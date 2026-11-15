import { describe, expect, it } from 'vitest'
import {
  extractWindowsSpeechErrorCode,
  parseSttPreference,
  resolveSttBackend,
  shouldFallbackToWhisper,
  windowsSpeechUserMessage,
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
  it('cai no Whisper também se permissão negada (PTT continua útil)', () => {
    expect(shouldFallbackToWhisper('not-allowed')).toBe(true)
    expect(shouldFallbackToWhisper('service-not-allowed')).toBe(true)
  })

  it('cai no Whisper em erros recuperáveis / vazio', () => {
    expect(shouldFallbackToWhisper('network')).toBe(true)
    expect(shouldFallbackToWhisper('audio-capture')).toBe(true)
    expect(shouldFallbackToWhisper(null)).toBe(true)
  })
})

describe('extractWindowsSpeechErrorCode', () => {
  it('extrai código após o prefixo', () => {
    expect(extractWindowsSpeechErrorCode('WINDOWS_SPEECH_ERROR:not-allowed')).toBe(
      'not-allowed',
    )
    expect(extractWindowsSpeechErrorCode('WINDOWS_SPEECH_ERROR:service-not-allowed')).toBe(
      'service-not-allowed',
    )
  })
})

describe('windowsSpeechUserMessage', () => {
  it('não vaza código cru not-allowed', () => {
    const msg = windowsSpeechUserMessage(new Error('WINDOWS_SPEECH_ERROR:not-allowed'))
    expect(msg.toLowerCase()).not.toContain('windows_speech_error')
    expect(msg.toLowerCase()).not.toContain('not-allowed')
    expect(msg).toMatch(/permissão|microfone|fala|windows/i)
  })

  it('mensagem curta o bastante para a barra', () => {
    const msg = windowsSpeechUserMessage(new Error('WINDOWS_SPEECH_ERROR:not-allowed'))
    expect(msg.length).toBeLessThan(120)
  })
})
