import { afterEach, describe, expect, it, vi } from 'vitest'
import { getWeatherSnapshot } from '../src/main/services/tools/weather'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('getWeatherSnapshot', () => {
  it('monta resumo a partir do Open-Meteo (fetch mock)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          current: {
            time: '2026-11-15T19:00',
            temperature_2m: 27.5,
            relative_humidity_2m: 61,
            weather_code: 2,
            wind_speed_10m: 12,
          },
        }),
      })),
    )

    const snap = await getWeatherSnapshot()
    expect(snap.temperatureC).toBe(27.5)
    expect(snap.conditionPt).toBe('parcialmente nublado')
    expect(snap.summary).toMatch(/27\.5°C/)
    expect(snap.summary).toMatch(/São Paulo/)
  })
})
