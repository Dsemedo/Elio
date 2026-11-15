/**
 * Clima via Open-Meteo (sem API key).
 * Local: ELIO_WEATHER_LAT+LON → ELIO_WEATHER_CITY (geocode) → São Paulo.
 */

export type WeatherLocation = {
  name: string
  latitude: number
  longitude: number
  source: 'env-coords' | 'env-city' | 'default'
}

export type WeatherSnapshot = {
  location: WeatherLocation
  temperatureC: number
  humidityPercent: number | null
  windKmh: number | null
  weatherCode: number
  conditionPt: string
  observedAt: string | null
  summary: string
}

const DEFAULT_CITY = 'São Paulo'
const DEFAULT_LAT = -23.5505
const DEFAULT_LON = -46.6333
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const FETCH_TIMEOUT_MS = 8_000

/** Códigos WMO usados pelo Open-Meteo → pt-BR curto. */
const WMO_PT: Record<number, string> = {
  0: 'céu limpo',
  1: 'principalmente limpo',
  2: 'parcialmente nublado',
  3: 'nublado',
  45: 'neblina',
  48: 'neblina com geada',
  51: 'garoa fraca',
  53: 'garoa',
  55: 'garoa forte',
  61: 'chuva fraca',
  63: 'chuva',
  65: 'chuva forte',
  66: 'chuva gelada fraca',
  67: 'chuva gelada',
  71: 'neve fraca',
  73: 'neve',
  75: 'neve forte',
  77: 'grãos de neve',
  80: 'pancadas de chuva fracas',
  81: 'pancadas de chuva',
  82: 'pancadas de chuva fortes',
  85: 'pancadas de neve',
  86: 'pancadas de neve fortes',
  95: 'trovoada',
  96: 'trovoada com granizo fraco',
  99: 'trovoada com granizo',
}

export function weatherCodeToPt(code: number): string {
  return WMO_PT[code] ?? `condição (código ${code})`
}

function parseCoord(raw: string | undefined): number | null {
  if (!raw?.trim()) return null
  const n = Number(raw.trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function resolveWeatherLocationFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): WeatherLocation {
  const lat = parseCoord(env['ELIO_WEATHER_LAT'])
  const lon = parseCoord(env['ELIO_WEATHER_LON'])
  if (lat !== null && lon !== null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
    const name = env['ELIO_WEATHER_CITY']?.trim() || `coords ${lat.toFixed(2)},${lon.toFixed(2)}`
    return { name, latitude: lat, longitude: lon, source: 'env-coords' }
  }

  const city = env['ELIO_WEATHER_CITY']?.trim()
  if (city) {
    return {
      name: city.slice(0, 80),
      latitude: DEFAULT_LAT,
      longitude: DEFAULT_LON,
      source: 'env-city',
    }
  }

  return {
    name: DEFAULT_CITY,
    latitude: DEFAULT_LAT,
    longitude: DEFAULT_LON,
    source: 'default',
  }
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  const onAbort = (): void => controller.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    return (await res.json()) as unknown
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

export async function geocodeCity(
  city: string,
  signal?: AbortSignal,
): Promise<{ name: string; latitude: number; longitude: number } | null> {
  const q = city.trim().slice(0, 80)
  if (!q) return null
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(q)}&count=1&language=pt&format=json`
  const data = (await fetchJson(url, signal)) as {
    results?: Array<{ name?: string; latitude?: number; longitude?: number; admin1?: string }>
  }
  const hit = data.results?.[0]
  if (
    !hit ||
    typeof hit.latitude !== 'number' ||
    typeof hit.longitude !== 'number' ||
    !hit.name
  ) {
    return null
  }
  const label = hit.admin1 ? `${hit.name}, ${hit.admin1}` : hit.name
  return { name: label, latitude: hit.latitude, longitude: hit.longitude }
}

export async function resolveWeatherLocation(
  signal?: AbortSignal,
  env: NodeJS.ProcessEnv = process.env,
): Promise<WeatherLocation> {
  const base = resolveWeatherLocationFromEnv(env)
  if (base.source === 'env-coords') return base

  if (base.source === 'env-city') {
    const geo = await geocodeCity(base.name, signal)
    if (geo) {
      return { ...geo, source: 'env-city' }
    }
    // Cidade não resolvida: mantém coords padrão com o nome pedido.
    return base
  }

  return base
}

export async function getWeatherSnapshot(signal?: AbortSignal): Promise<WeatherSnapshot> {
  const location = await resolveWeatherLocation(signal)
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
    timezone: process.env['ELIO_TIMEZONE']?.trim() || 'America/Sao_Paulo',
    wind_speed_unit: 'kmh',
  })
  const data = (await fetchJson(`${FORECAST_URL}?${params}`, signal)) as {
    current?: {
      time?: string
      temperature_2m?: number
      relative_humidity_2m?: number
      weather_code?: number
      wind_speed_10m?: number
    }
  }
  const current = data.current
  if (!current || typeof current.temperature_2m !== 'number') {
    throw new Error('Open-Meteo não devolveu temperatura atual')
  }
  const weatherCode = typeof current.weather_code === 'number' ? current.weather_code : -1
  const conditionPt = weatherCodeToPt(weatherCode)
  const humidity =
    typeof current.relative_humidity_2m === 'number' ? current.relative_humidity_2m : null
  const wind = typeof current.wind_speed_10m === 'number' ? current.wind_speed_10m : null
  const parts = [
    `Clima em ${location.name}: ${current.temperature_2m}°C, ${conditionPt}`,
  ]
  if (humidity !== null) parts.push(`umidade ${humidity}%`)
  if (wind !== null) parts.push(`vento ${wind} km/h`)
  return {
    location,
    temperatureC: current.temperature_2m,
    humidityPercent: humidity,
    windKmh: wind,
    weatherCode,
    conditionPt,
    observedAt: current.time ?? null,
    summary: parts.join('; ') + '.',
  }
}
