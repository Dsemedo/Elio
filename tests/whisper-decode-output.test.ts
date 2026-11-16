import { describe, expect, it } from 'vitest'
import { decodeWhisperOutputBytes } from '../src/main/services/voice/decodeOutput'

describe('decodeWhisperOutputBytes', () => {
  it('lê UTF-8 válido', () => {
    expect(decodeWhisperOutputBytes(Buffer.from('Qual é a hora?', 'utf8'))).toBe(
      'Qual é a hora?',
    )
  })

  it('recupera é (0xE9) quando UTF-8 vira U+FFFD (CP1252/latin1)', () => {
    // "Qual " + é em latin1 + " o hora?"
    const buf = Buffer.from([
      ...Buffer.from('Qual ', 'ascii'),
      0xe9,
      ...Buffer.from(' o hora?', 'ascii'),
    ])
    expect(decodeWhisperOutputBytes(buf)).toBe('Qual é o hora?')
  })

  it('não troca UTF-8 multilíngue válido por latin1', () => {
    const text = 'Como está o tempo hoje'
    expect(decodeWhisperOutputBytes(Buffer.from(text, 'utf8'))).toBe(text)
  })
})
