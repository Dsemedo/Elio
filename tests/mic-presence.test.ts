import { describe, expect, it } from 'vitest'
import { isMicMissingMessage } from '../src/shared/micMessages'

describe('isMicMissingMessage', () => {
  it('reconhece ausência real e mau contato', () => {
    expect(
      isMicMissingMessage(
        'Nenhum microfone encontrado. Conecte um mic e tente de novo.',
      ),
    ).toBe(true)
    expect(
      isMicMissingMessage(
        'Microfone listado, mas sem sinal — confira o encaixe / mau contato e tente de novo.',
      ),
    ).toBe(true)
    expect(isMicMissingMessage('Áudio muito curto — segure e fale um pouco mais.')).toBe(
      false,
    )
    expect(isMicMissingMessage(null)).toBe(false)
  })
})
