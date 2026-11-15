import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveLocationFromIp } from '../src/main/services/location/ip'
import { reverseGeocodeCity } from '../src/main/services/location/reverse'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('resolveLocationFromIp', () => {
  it('parseia ipwho.is com sucesso', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          latitude: -16.68,
          longitude: -49.26,
          city: 'Goiânia',
          region: 'Goiás',
          country_code: 'BR',
        }),
      })),
    )
    const loc = await resolveLocationFromIp()
    expect(loc?.name).toMatch(/Goiânia/)
    expect(loc?.latitude).toBeCloseTo(-16.68)
  })

  it('retorna null se success=false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ success: false }),
      })),
    )
    expect(await resolveLocationFromIp()).toBeNull()
  })
})

describe('reverseGeocodeCity', () => {
  it('monta nome a partir do Open-Meteo reverse', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          results: [{ name: 'Goiânia', admin1: 'Goiás', country: 'Brasil' }],
        }),
      })),
    )
    const name = await reverseGeocodeCity(-16.68, -49.26)
    expect(name).toBe('Goiânia, Goiás')
  })
})
