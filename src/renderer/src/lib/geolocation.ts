/**
 * Geolocation via Chromium (Windows Location API por baixo).
 * Requer gesto do usuário em alguns fluxos; o send do chat conta como gesto.
 */

export type OsGeoResult =
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; denied: boolean; message: string }

export function requestOsGeolocation(timeoutMs = 12_000): Promise<OsGeoResult> {
  if (!navigator.geolocation) {
    return Promise.resolve({
      ok: false,
      denied: true,
      message: 'Geolocalização não disponível neste ambiente.',
    })
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          ok: true,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        })
      },
      (err) => {
        const denied = err.code === err.PERMISSION_DENIED
        resolve({
          ok: false,
          denied,
          message: denied
            ? 'Permissão de localização negada.'
            : 'Não foi possível obter a localização.',
        })
      },
      {
        enableHighAccuracy: false,
        timeout: timeoutMs,
        maximumAge: 30 * 60_000,
      },
    )
  })
}

/**
 * Garante cache de localização antes do clima.
 * 1) cache 2) OS/geolocation 3) IP no main (privacidade documentada).
 * Retorna só o nome público — nunca coords no renderer além do save IPC.
 */
export async function ensureAppLocation(): Promise<{
  name: string
  source: string
} | null> {
  const cached = await window.elio.getLocation()
  if (cached) return { name: cached.name, source: cached.source }

  const os = await requestOsGeolocation()
  if (os.ok) {
    const saved = await window.elio.saveOsLocation({
      latitude: os.latitude,
      longitude: os.longitude,
    })
    return { name: saved.name, source: saved.source }
  }

  const ip = await window.elio.ensureIpLocationFallback()
  if (ip) return { name: ip.name, source: ip.source }
  return null
}
