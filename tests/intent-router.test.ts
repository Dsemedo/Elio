import { describe, expect, it } from 'vitest'
import { classifyUserIntent, laneLabel } from '../src/main/services/tools/router'

describe('classifyUserIntent — lanes A/B/C/D', () => {
  it('A: ação no PC (abrir site/pasta)', () => {
    const site = classifyUserIntent('abre o site da Exame')
    expect(site.lane).toBe('pc_action')
    if (site.lane === 'pc_action') {
      expect(site.desktop.kind).toBe('open_url')
      expect(site.confirmRisky).toBe(false)
    }

    const folder = classifyUserIntent('abre a pasta Downloads')
    expect(folder.lane).toBe('pc_action')
  })

  it('A: confirmação de path sensível', () => {
    const c = classifyUserIntent('confirma abrir .ssh')
    expect(c.lane).toBe('pc_action')
    if (c.lane === 'pc_action') {
      expect(c.confirmRisky).toBe(true)
    }
  })

  it('B: fato local (hora / clima)', () => {
    const time = classifyUserIntent('que horas são?')
    expect(time.lane).toBe('local_fact')
    if (time.lane === 'local_fact') {
      expect(time.tools.needsTime).toBe(true)
    }

    const weather = classifyUserIntent('como está o tempo?')
    expect(weather.lane).toBe('local_fact')
    if (weather.lane === 'local_fact') {
      expect(weather.tools.needsWeather).toBe(true)
    }
  })

  it('C: web_context fica deferred (sem ler aba)', () => {
    const tab = classifyUserIntent('o que está na aba aberta?')
    expect(tab.lane).toBe('web_context')
    if (tab.lane === 'web_context') {
      expect(tab.deferred).toBe(true)
      expect(tab.reason).toMatch(/extensão|CDP/i)
    }

    const research = classifyUserIntent('pesquisa na web sobre Elio')
    expect(research.lane).toBe('web_context')
  })

  it('D: conversa geral', () => {
    expect(classifyUserIntent('olá, tudo bem?').lane).toBe('chat')
    expect(classifyUserIntent('me explique o que é um ADR').lane).toBe('chat')
  })

  it('labels amigáveis', () => {
    expect(laneLabel('pc_action')).toContain('PC')
    expect(laneLabel('web_context')).toMatch(/em breve/i)
  })
})
