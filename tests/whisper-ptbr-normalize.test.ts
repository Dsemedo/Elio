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

  it('corrige Qual é a hora com mangling / U+FFFD', () => {
    expect(normalizeWhisperPtBr('Qual \uFFFD o hora?')).toBe('Qual é a hora?')
    expect(normalizeWhisperPtBr('Qual e o hora?')).toBe('Qual é a hora?')
    expect(normalizeWhisperPtBr('qual e a hora')).toBe('Qual é a hora')
  })

  it('colapsa espaços', () => {
    expect(normalizeWhisperPtBr('  clima   outdoor  ')).toBe('clima atual')
  })

  it('corrige artigo o→ou após jornal/site (mangling STT)', () => {
    expect(normalizeWhisperPtBr('Abre o jornal ou popular')).toBe(
      'Abre o jornal o popular',
    )
    expect(normalizeWhisperPtBr('abre o site ou g1')).toBe('abre o site o g1')
  })
})
