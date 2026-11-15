import { describe, expect, it } from 'vitest'
import {
  parseTtsEnabled,
  parseTtsPreference,
  prepareTextForSpeech,
  resolveTtsBackend,
  TTS_MAX_CHARS,
} from '../src/shared/ttsPolicy'

describe('parseTtsPreference', () => {
  it('aceita valores conhecidos', () => {
    expect(parseTtsPreference('auto')).toBe('auto')
    expect(parseTtsPreference('SYSTEM')).toBe('system')
    expect(parseTtsPreference('edge')).toBe('edge')
  })

  it('cai em auto se inválido', () => {
    expect(parseTtsPreference('')).toBe('auto')
    expect(parseTtsPreference('foo')).toBe('auto')
    expect(parseTtsPreference(undefined)).toBe('auto')
  })
})

describe('parseTtsEnabled', () => {
  it('interpreta truthy/falsy comuns', () => {
    expect(parseTtsEnabled('1')).toBe(true)
    expect(parseTtsEnabled('true')).toBe(true)
    expect(parseTtsEnabled('0')).toBe(false)
    expect(parseTtsEnabled('off')).toBe(false)
    expect(parseTtsEnabled(undefined)).toBeNull()
    expect(parseTtsEnabled('maybe')).toBeNull()
  })
})

describe('resolveTtsBackend', () => {
  it('auto com voz pt-BR → system', () => {
    expect(resolveTtsBackend({ preference: 'auto', systemPtBrAvailable: true })).toBe(
      'system',
    )
  })

  it('auto sem voz pt-BR → edge', () => {
    expect(resolveTtsBackend({ preference: 'auto', systemPtBrAvailable: false })).toBe(
      'edge',
    )
  })

  it('force system / edge', () => {
    expect(resolveTtsBackend({ preference: 'system', systemPtBrAvailable: false })).toBe(
      'system',
    )
    expect(resolveTtsBackend({ preference: 'edge', systemPtBrAvailable: true })).toBe(
      'edge',
    )
  })
})

describe('prepareTextForSpeech', () => {
  it('remove markdown leve', () => {
    expect(prepareTextForSpeech('**olá** _mundo_')).toBe('olá mundo')
    expect(prepareTextForSpeech('[docs](https://x.test)')).toBe('docs')
    expect(prepareTextForSpeech('use `npm` agora')).toBe('use npm agora')
  })

  it('trunca no limite', () => {
    const long = 'a'.repeat(TTS_MAX_CHARS + 50)
    const out = prepareTextForSpeech(long)
    expect(out.length).toBeLessThanOrEqual(TTS_MAX_CHARS)
    expect(out.endsWith('…')).toBe(true)
  })
})
