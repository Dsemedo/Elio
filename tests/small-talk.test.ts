import { describe, expect, it } from 'vitest'
import {
  isSmallTalk,
  localSmallTalkReply,
} from '../src/main/services/tools/smallTalk'

describe('isSmallTalk', () => {
  it('reconhece cumprimentos curtos', () => {
    expect(isSmallTalk('oi')).toBe(true)
    expect(isSmallTalk('Olá')).toBe(true)
    expect(isSmallTalk('bom dia')).toBe(true)
    expect(isSmallTalk('oi, tudo bem?')).toBe(true)
    expect(isSmallTalk('Elio, tudo bem')).toBe(true)
    expect(isSmallTalk('obrigado')).toBe(true)
    expect(isSmallTalk('tchau')).toBe(true)
  })

  it('rejeita pedidos e frases longas', () => {
    expect(isSmallTalk('me explique o que é um ADR')).toBe(false)
    expect(isSmallTalk('abre o Chrome')).toBe(false)
    expect(isSmallTalk('gera uma imagem de um gato')).toBe(false)
    expect(
      isSmallTalk(
        'oi tudo bem quero que você me explique detalhadamente a história do Brasil',
      ),
    ).toBe(false)
  })
})

describe('localSmallTalkReply', () => {
  it('responde sem depender de rede/hub', () => {
    expect(localSmallTalkReply('oi, tudo bem?')).toMatch(/Tudo bem/i)
    expect(localSmallTalkReply('bom dia')).toMatch(/Bom dia/i)
    expect(localSmallTalkReply('obrigado')).toMatch(/Por nada/i)
    expect(localSmallTalkReply('tchau')).toMatch(/Até mais/i)
    expect(localSmallTalkReply('oi')).toMatch(/Oi/i)
  })
})
