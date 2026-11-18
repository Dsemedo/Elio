import { describe, expect, it } from 'vitest'
import { classifyUserIntent, laneLabel } from '../src/main/services/tools/router'

describe('classifyUserIntent — lanes A/B/C/escalate/local/D', () => {
  it('A: ação no PC (abrir site/pasta)', () => {
    const site = classifyUserIntent('abre o site da Exame')
    expect(site.lane).toBe('pc_action')
    if (site.lane === 'pc_action' && site.action === 'desktop') {
      expect(site.desktop.kind).toBe('open_url')
      expect(site.confirmRisky).toBe(false)
    }

    const folder = classifyUserIntent('abre a pasta Downloads')
    expect(folder.lane).toBe('pc_action')
  })

  it('A: confirmação de path sensível', () => {
    const c = classifyUserIntent('confirma abrir .ssh')
    expect(c.lane).toBe('pc_action')
    if (c.lane === 'pc_action' && c.action === 'desktop') {
      expect(c.confirmRisky).toBe(true)
    }
  })

  it('A: Spotify play/connect', () => {
    const play = classifyUserIntent('Elio, tocar música no Spotify')
    expect(play.lane).toBe('pc_action')
    if (play.lane === 'pc_action') {
      expect(play.action).toBe('spotify')
    }
  })

  it('B: fato local (hora / clima)', () => {
    const time = classifyUserIntent('que horas são?')
    expect(time.lane).toBe('local_fact')
    if (time.lane === 'local_fact') {
      expect(time.tools.needsTime).toBe(true)
    }

    const timePhrase = classifyUserIntent('Qual é a hora?')
    expect(timePhrase.lane).toBe('local_fact')
    if (timePhrase.lane === 'local_fact') {
      expect(timePhrase.tools.needsTime).toBe(true)
      expect(timePhrase.tools.needsWeather).toBe(false)
    }

    const weather = classifyUserIntent('como está o tempo?')
    expect(weather.lane).toBe('local_fact')
    if (weather.lane === 'local_fact') {
      expect(weather.tools.needsWeather).toBe(true)
    }
  })

  it('C: aba ativa (precisa extensão)', () => {
    const tab = classifyUserIntent('o que está na aba aberta?')
    expect(tab.lane).toBe('web_context')
    if (tab.lane === 'web_context') {
      expect(tab.web.kind).toBe('active_tab')
    }
  })

  it('C: pesquisa web leve', () => {
    const research = classifyUserIntent('pesquisa na web sobre Elio')
    expect(research.lane).toBe('web_context')
    if (research.lane === 'web_context') {
      expect(research.web.kind).toBe('web_research')
      if (research.web.kind === 'web_research') {
        expect(research.web.query.toLowerCase()).toContain('elio')
      }
    }
  })

  it('local_reply: small talk sem hub', () => {
    const oi = classifyUserIntent('olá, tudo bem?')
    expect(oi.lane).toBe('local_reply')
    if (oi.lane === 'local_reply') {
      expect(oi.kind).toBe('small_talk')
    }
    expect(classifyUserIntent('oi').lane).toBe('local_reply')
    expect(classifyUserIntent('bom dia').lane).toBe('local_reply')
  })

  it('escalate: CLOUD:image / CLOUD:codegen', () => {
    const img = classifyUserIntent('gera uma imagem de um gato')
    expect(img.lane).toBe('escalate')
    if (img.lane === 'escalate') {
      expect(img.kind).toBe('image')
    }

    const site = classifyUserIntent('faz um site completo de landing page')
    expect(site.lane).toBe('escalate')
    if (site.lane === 'escalate') {
      expect(site.kind).toBe('codegen')
    }
  })

  it('D: conversa geral (ainda hub)', () => {
    expect(classifyUserIntent('me explique o que é um ADR').lane).toBe('chat')
  })

  it('opens não caem em escalate nem chat', () => {
    expect(classifyUserIntent('abre o Google Chrome').lane).toBe('pc_action')
  })

  it('labels amigáveis', () => {
    expect(laneLabel('pc_action')).toContain('PC')
    expect(laneLabel('web_context')).toBe('Contexto web')
    expect(laneLabel('local_reply')).toBe('Resposta local')
    expect(laneLabel('escalate')).toContain('Cascata')
  })
})
