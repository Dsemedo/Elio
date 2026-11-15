/**
 * Fallback IP → lat/lon + cidade.
 * Só usado se a permissão OS/geolocation for negada ou falhar.
 * Privacidade: consulta um serviço HTTPS sem API key; o IP público do usuário
 * é visível para esse endpoint (como em qualquer site). Não enviamos o resultado
 * a provedores LLM além do nome da cidade no enrich de clima.
 */

export type IpGeoResult = {
  latitude: number
  longitude: number
  name: string
}

const FETCH_TIMEOUT_MS = 6_000
/** ipwho.is — sem chave; resposta JSON com city/region. */
const IPWHO_URL = 'https://ipwho.is/'

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  const onAbort = (): void => controller.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as unknown
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

export async function resolveLocationFromIp(
  signal?: AbortSignal,
): Promise<IpGeoResult | null> {
  try {
    const data = (await fetchJson(IPWHO_URL, signal)) as {
      success?: boolean
      latitude?: number
      longitude?: number
      city?: string
      region?: string
      country_code?: string
    }
    if (
      data.success === false ||
      typeof data.latitude !== 'number' ||
      typeof data.longitude !== 'number' ||
      !Number.isFinite(data.latitude) ||
      !Number.isFinite(data.longitude)
    ) {
      return null
    }
    const city = data.city?.trim()
    const region = data.region?.trim()
    const name =
      city && region
        ? `${city}, ${region}`.slice(0, 120)
        : city || region || 'Local aproximado (IP)'
    return {
      latitude: data.latitude,
      longitude: data.longitude,
      name,
    }
  } catch {
    return null
  }
}
