import { describe, expect, it } from 'vitest'
import { detectChatToolIntent } from '../src/main/services/tools/intent'
import { getLocalClock, DEFAULT_TIMEZONE } from '../src/main/services/tools/time'
import {
  resolveWeatherLocationFromEnv,
  weatherCodeToPt,
} from '../src/main/services/tools/weather'
import { enrichMessagesWithLocalFacts } from '../src/main/services/tools/enrich'

describe('detectChatToolIntent', () => {
  it('detecta perguntas de hora em pt-BR', () => {
    expect(detectChatToolIntent('que horas são?').needsTime).toBe(true)
    expect(detectChatToolIntent('Qual a hora agora').needsTime).toBe(true)
    expect(detectChatToolIntent('que dia é hoje?').needsTime).toBe(true)
    expect(detectChatToolIntent('olá').needsTime).toBe(false)
  })

  it('detecta perguntas de clima em pt-BR', () => {
    expect(detectChatToolIntent('como está o tempo?').needsWeather).toBe(true)
    expect(detectChatToolIntent('qual a temperatura hoje').needsWeather).toBe(true)
    expect(detectChatToolIntent('está chovendo?').needsWeather).toBe(true)
    expect(detectChatToolIntent('me conte uma piada').needsWeather).toBe(false)
  })
})

describe('getLocalClock', () => {
  it('formata relógio em America/Sao_Paulo', () => {
    const prev = process.env['ELIO_TIMEZONE']
    process.env['ELIO_TIMEZONE'] = DEFAULT_TIMEZONE
    try {
      const clock = getLocalClock(new Date('2026-11-15T18:30:00.000Z'))
      expect(clock.timezone).toBe(DEFAULT_TIMEZONE)
      expect(clock.display).toContain(DEFAULT_TIMEZONE)
      expect(clock.time).toMatch(/^\d{2}:\d{2}:\d{2}$/)
      expect(clock.date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
    } finally {
      if (prev === undefined) delete process.env['ELIO_TIMEZONE']
      else process.env['ELIO_TIMEZONE'] = prev
    }
  })
})

describe('weather helpers', () => {
  it('mapeia códigos WMO', () => {
    expect(weatherCodeToPt(0)).toBe('céu limpo')
    expect(weatherCodeToPt(61)).toBe('chuva fraca')
    expect(weatherCodeToPt(12345)).toContain('12345')
  })

  it('resolve local via env (coords)', () => {
    const loc = resolveWeatherLocationFromEnv({
      ELIO_WEATHER_LAT: '-22.9',
      ELIO_WEATHER_LON: '-47.06',
      ELIO_WEATHER_CITY: 'Campinas',
    } as NodeJS.ProcessEnv)
    expect(loc.source).toBe('env-coords')
    expect(loc.name).toBe('Campinas')
    expect(loc.latitude).toBeCloseTo(-22.9)
    expect(loc.longitude).toBeCloseTo(-47.06)
  })

  it('usa São Paulo como padrão', () => {
    const loc = resolveWeatherLocationFromEnv({} as NodeJS.ProcessEnv)
    expect(loc.source).toBe('default')
    expect(loc.name).toBe('São Paulo')
  })
})

describe('enrichMessagesWithLocalFacts', () => {
  it('sempre injeta system com relógio', async () => {
    const enriched = await enrichMessagesWithLocalFacts([
      { role: 'user', content: 'olá' },
    ])
    expect(enriched[0]?.role).toBe('system')
    expect(enriched[0]?.content).toMatch(/Agora:/)
    expect(enriched[1]?.content).toBe('olá')
  })

  it('marca pergunta de hora sem chamar clima', async () => {
    const enriched = await enrichMessagesWithLocalFacts([
      { role: 'user', content: 'que horas são?' },
    ])
    expect(enriched[0]?.content).toMatch(/relógio|hora\/data|Agora:/i)
    expect(enriched[0]?.content).not.toMatch(/Open-Meteo/)
  })
})
