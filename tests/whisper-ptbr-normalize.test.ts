import { describe, expect, it } from 'vitest'
import {
  isWhisperHallucinationOnly,
  normalizeWhisperPtBr,
} from '../src/shared/whisperPtBrNormalize'

describe('normalizeWhisperPtBr', () => {
  it('corrige outdoor → atual no domínio clima/hora (caso README)', () => {
    expect(normalizeWhisperPtBr('Qual é o clima outdoor')).toBe(
      'Qual é o clima atual',
    )
    expect(
      normalizeWhisperPtBr('qual é o clima outdoor do lugar que eu moro'),
    ).toBe('qual é o clima atual do lugar que eu moro')
    expect(normalizeWhisperPtBr('Como está o tempo outdoor hoje')).toBe(
      'Como está o tempo atual hoje',
    )
    expect(normalizeWhisperPtBr('Qual é o horário outdoor')).toBe(
      'Qual é o horário atual',
    )
  })

  it('não troca outdoor fora do domínio', () => {
    expect(normalizeWhisperPtBr('Vamos jogar outdoor')).toBe(
      'Vamos jogar outdoor',
    )
  })

  it('remove alucinações óbvias do Whisper', () => {
    expect(normalizeWhisperPtBr('Thanks for watching.')).toBe('')
    expect(normalizeWhisperPtBr('Thank you.')).toBe('')
    expect(isWhisperHallucinationOnly('Subscribe')).toBe(true)
  })

  it('preserva frases PT-BR corretas', () => {
    expect(normalizeWhisperPtBr('Abre o Chrome')).toBe('Abre o Chrome')
    expect(normalizeWhisperPtBr('Que horas são?')).toBe('Que horas são?')
  })

  it('colapsa espaços', () => {
    expect(normalizeWhisperPtBr('  clima   outdoor  ')).toBe('clima atual')
  })
})
