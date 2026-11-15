/**
 * Reverse geocode barato via Open-Meteo (sem API key).
 */

const REVERSE_URL = 'https://geocoding-api.open-meteo.com/v1/reverse'
const FETCH_TIMEOUT_MS = 6_000

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  const onAbort = (): void => controller.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as unknown
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

export async function reverseGeocodeCity(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<string | null> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    language: 'pt',
    format: 'json',
  })
  try {
    const data = (await fetchJson(`${REVERSE_URL}?${params}`, signal)) as {
      results?: Array<{ name?: string; admin1?: string; country?: string }>
    }
    const hit = data.results?.[0]
    if (!hit?.name) return null
    if (hit.admin1) return `${hit.name}, ${hit.admin1}`.slice(0, 120)
    return hit.name.slice(0, 120)
  } catch {
    return null
  }
}
