import { describe, expect, it } from 'vitest'
import {
  emptySpeechUserMessage,
  extractWindowsSpeechErrorCode,
  isSpeechPermissionDenied,
  parseSttPreference,
  resolveSttBackend,
  sanitizeVoiceUiError,
  shouldFallbackToWhisper,
  whisperFallbackStatusMessage,
  windowsSpeechUserMessage,
} from '../src/shared/sttPolicy'
import { micAccessDeniedUserMessage } from '../src/shared/micMessages'

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
  it('auto no Windows → whisper (mesmo com SpeechRecognition)', () => {
    expect(
      resolveSttBackend({
        platform: 'win32',
        speechRecognitionAvailable: true,
        preference: 'auto',
      }),
    ).toBe('whisper')
  })

  it('auto sem SpeechRecognition → whisper', () => {
    expect(
      resolveSttBackend({
        platform: 'win32',
        speechRecognitionAvailable: false,
        preference: 'auto',
      }),
    ).toBe('whisper')
  })

  it('auto no Linux / darwin → whisper', () => {
    expect(
      resolveSttBackend({
        platform: 'linux',
        speechRecognitionAvailable: true,
        preference: 'auto',
      }),
    ).toBe('whisper')
    expect(
      resolveSttBackend({
        platform: 'darwin',
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

  it('force windows-speech com API → windows-speech', () => {
    expect(
      resolveSttBackend({
        platform: 'win32',
        speechRecognitionAvailable: true,
        preference: 'windows-speech',
      }),
    ).toBe('windows-speech')
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

describe('isSpeechPermissionDenied', () => {
  it('reconhece not-allowed e service-not-allowed', () => {
    expect(isSpeechPermissionDenied('not-allowed')).toBe(true)
    expect(isSpeechPermissionDenied('service-not-allowed')).toBe(true)
    expect(isSpeechPermissionDenied('network')).toBe(false)
    expect(isSpeechPermissionDenied(null)).toBe(false)
  })
})

describe('shouldFallbackToWhisper', () => {
  it('NÃO cai no Whisper se permissão negada (chip PT-BR)', () => {
    expect(shouldFallbackToWhisper('not-allowed')).toBe(false)
    expect(shouldFallbackToWhisper('service-not-allowed')).toBe(false)
  })

  it('NÃO cai no Whisper em no-speech / aborted', () => {
    expect(shouldFallbackToWhisper('no-speech')).toBe(false)
    expect(shouldFallbackToWhisper('aborted')).toBe(false)
  })

  it('cai no Whisper em falhas duras ao iniciar o Speech', () => {
    expect(shouldFallbackToWhisper('network')).toBe(true)
    expect(shouldFallbackToWhisper('audio-capture')).toBe(true)
    expect(shouldFallbackToWhisper(null)).toBe(true)
  })
})

describe('emptySpeechUserMessage', () => {
  it('orienta a falar de novo em no-speech', () => {
    expect(emptySpeechUserMessage('no-speech')).toMatch(/não ouvi|fale/i)
    expect(emptySpeechUserMessage('no-speech').toLowerCase()).not.toContain('whisper')
  })
})

describe('whisperFallbackStatusMessage', () => {
  it('mostra engine + motivo curto', () => {
    expect(whisperFallbackStatusMessage('network')).toBe(
      'Speech falhou (rede) — Whisper',
    )
    expect(whisperFallbackStatusMessage('audio-capture')).toBe(
      'Speech falhou (áudio) — Whisper',
    )
    expect(whisperFallbackStatusMessage('no-speech')).toBe(
      'Speech sem fala — Whisper',
    )
    expect(whisperFallbackStatusMessage(null)).toBe('Speech falhou — Whisper')
  })

  it('nunca inclui prefixo WINDOWS_SPEECH_ERROR', () => {
    const msg = whisperFallbackStatusMessage('network')
    expect(msg.toLowerCase()).not.toContain('windows_speech')
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
  it('não vaza código cru not-allowed e aponta Privacidade Windows', () => {
    const msg = windowsSpeechUserMessage(new Error('WINDOWS_SPEECH_ERROR:not-allowed'))
    expect(msg.toLowerCase()).not.toContain('windows_speech_error')
    expect(msg.toLowerCase()).not.toContain('not-allowed')
    expect(msg).toMatch(/microfone|privacidade|windows/i)
  })

  it('mensagem curta o bastante para a barra', () => {
    const msg = windowsSpeechUserMessage(new Error('WINDOWS_SPEECH_ERROR:not-allowed'))
    expect(msg.length).toBeLessThan(120)
  })
})

describe('micAccessDeniedUserMessage', () => {
  it('orienta Privacidade → Microfone (desktop / Elio)', () => {
    const msg = micAccessDeniedUserMessage()
    expect(msg).toMatch(/privacidade/i)
    expect(msg).toMatch(/microfone/i)
    expect(msg).toMatch(/desktop|elio/i)
  })
})

describe('sanitizeVoiceUiError', () => {
  it('nunca deixa código cru na UI', () => {
    const msg = sanitizeVoiceUiError('WINDOWS_SPEECH_ERROR:not-allowed')
    expect(msg.toLowerCase()).not.toContain('windows_speech_error')
    expect(msg.toLowerCase()).not.toContain('not-allowed')
    expect(msg).toMatch(/microfone|privacidade|fala/i)
  })

  it('preserva mensagens amigáveis', () => {
    expect(sanitizeVoiceUiError('Áudio muito curto — segure e fale um pouco mais.')).toContain(
      'curto',
    )
  })
})
