import { afterEach, describe, expect, it, vi } from 'vitest'
import { getWeatherSnapshot } from '../src/main/services/tools/weather'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete process.env['ELIO_WEATHER_LAT']
  delete process.env['ELIO_WEATHER_LON']
  delete process.env['ELIO_WEATHER_CITY']
})

describe('getWeatherSnapshot', () => {
  it('monta resumo a partir do Open-Meteo com coords de env (fetch mock)', async () => {
    process.env['ELIO_WEATHER_LAT'] = '-16.6869'
    process.env['ELIO_WEATHER_LON'] = '-49.2648'
    process.env['ELIO_WEATHER_CITY'] = 'Goiânia'

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) => {
        const url = String(input)
        if (url.includes('api.open-meteo.com')) {
          return {
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
          }
        }
        return { ok: false, json: async () => ({}) }
      }),
    )

    const snap = await getWeatherSnapshot()
    expect(snap.temperatureC).toBe(27.5)
    expect(snap.conditionPt).toBe('parcialmente nublado')
    expect(snap.summary).toMatch(/27\.5°C/)
    expect(snap.summary).toMatch(/Goiânia/)
    expect(snap.summary).not.toMatch(/-16\.|coords/i)
    expect(snap.location.source).toBe('env-coords')
  })

  it('cai em fallback São Paulo se IP/geo falharem (fetch mock)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) => {
        const url = String(input)
        if (url.includes('ipwho.is')) {
          return { ok: true, json: async () => ({ success: false }) }
        }
        if (url.includes('api.open-meteo.com')) {
          return {
            ok: true,
            json: async () => ({
              current: {
                time: '2026-11-15T19:00',
                temperature_2m: 22,
                relative_humidity_2m: 50,
                weather_code: 0,
                wind_speed_10m: 5,
              },
            }),
          }
        }
        return { ok: false, json: async () => ({}) }
      }),
    )

    const snap = await getWeatherSnapshot()
    expect(snap.location.source).toBe('fallback')
    expect(snap.summary).toMatch(/São Paulo/)
  })
})
