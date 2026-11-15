import { describe, expect, it } from 'vitest'
import {
  friendlyVoiceError,
  hasVoiceErrorPrefix,
  normalizeVoiceEnsureError,
  serializeVoiceError,
} from '../src/main/services/voice/errors'

describe('erros de voz', () => {
  it('reconhece prefixos tipados', () => {
    expect(hasVoiceErrorPrefix('DOWNLOAD_FAILED: x')).toBe(true)
    expect(hasVoiceErrorPrefix('EXTRACT_FAILED: x')).toBe(true)
    expect(hasVoiceErrorPrefix('INSTALL_FAILED: x')).toBe(true)
    expect(hasVoiceErrorPrefix('EPERM: rename')).toBe(false)
  })

  it('serializa Error com code e cause', () => {
    const err = new Error('fetch failed') as Error & { code?: string; cause?: Error }
    err.code = 'ENOTFOUND'
    err.cause = new Error('getaddrinfo')
    const serialized = serializeVoiceError(err)
    expect(serialized.name).toBe('Error')
    expect(serialized.message).toBe('fetch failed')
    expect(serialized.code).toBe('ENOTFOUND')
    expect(serialized.cause).toMatch(/getaddrinfo/)
  })

  it('normaliza AbortError e rede para DOWNLOAD_FAILED', () => {
    const abort = new Error('This operation was aborted')
    abort.name = 'AbortError'
    expect(normalizeVoiceEnsureError(abort).message).toMatch(/^DOWNLOAD_FAILED:.*tempo esgotado/)

    const net = new Error('fetch failed') as Error & { code?: string }
    net.code = 'ENOTFOUND'
    expect(normalizeVoiceEnsureError(net).message).toMatch(/^DOWNLOAD_FAILED:.*sem conexão/)
  })

  it('normaliza EPERM/EBUSY para INSTALL_FAILED', () => {
    const err = new Error('EPERM: operation not permitted, unlink') as NodeJS.ErrnoException
    err.code = 'EPERM'
    expect(normalizeVoiceEnsureError(err).message).toMatch(/^INSTALL_FAILED:/)
  })

  it('preserva erros já tipados', () => {
    const err = new Error('EXTRACT_FAILED: zip quebrado')
    expect(normalizeVoiceEnsureError(err)).toBe(err)
  })

  it('mapeia mensagens amigáveis incluindo extract/install/timeout', () => {
    expect(friendlyVoiceError('EXTRACT_FAILED: x')).toMatch(/extrair/i)
    expect(friendlyVoiceError('INSTALL_FAILED: x')).toMatch(/antivírus|instalar/i)
    expect(
      friendlyVoiceError('DOWNLOAD_FAILED: tempo esgotado ao baixar o Whisper'),
    ).toMatch(/demorou demais/i)
    expect(
      friendlyVoiceError('DOWNLOAD_FAILED: sem conexão para baixar o Whisper'),
    ).toMatch(/Sem conexão/i)
    expect(friendlyVoiceError('DOWNLOAD_FAILED: HTTP 503')).toMatch(/ocupado|minuto/i)
    expect(friendlyVoiceError('algo-interno-com-path')).toMatch(/digitar/i)
  })
})
