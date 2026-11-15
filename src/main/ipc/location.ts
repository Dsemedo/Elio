import { ipcMain } from 'electron'
import {
  IpcChannels,
  LocationSaveOsInputSchema,
  type AppLocation,
} from '../../shared/ipc'
import {
  readCachedLocation,
  writeCachedLocation,
} from '../services/location/cache'
import { resolveLocationFromIp } from '../services/location/ip'
import { reverseGeocodeCity } from '../services/location/reverse'

function toPublic(loc: NonNullable<ReturnType<typeof readCachedLocation>>): AppLocation {
  return {
    name: loc.name,
    source: loc.source,
    updatedAt: loc.updatedAt,
    ...(loc.permissionDenied !== undefined
      ? { permissionDenied: loc.permissionDenied }
      : {}),
  }
}

export function registerLocationIpc(): void {
  ipcMain.handle(IpcChannels.LOCATION_GET, (): AppLocation | null => {
    const cached = readCachedLocation()
    return cached ? toPublic(cached) : null
  })

  ipcMain.handle(
    IpcChannels.LOCATION_SAVE_OS,
    async (_event, raw: unknown): Promise<AppLocation> => {
      const input = LocationSaveOsInputSchema.parse(raw)
      const city =
        (await reverseGeocodeCity(input.latitude, input.longitude)) ||
        'Local atual'
      const saved = writeCachedLocation({
        latitude: input.latitude,
        longitude: input.longitude,
        name: city,
        source: 'os',
        updatedAt: new Date().toISOString(),
        permissionDenied: false,
      })
      return toPublic(saved)
    },
  )

  ipcMain.handle(
    IpcChannels.LOCATION_ENSURE_IP_FALLBACK,
    async (): Promise<AppLocation | null> => {
      const existing = readCachedLocation()
      if (existing) return toPublic(existing)

      const ip = await resolveLocationFromIp()
      if (!ip) return null

      const saved = writeCachedLocation({
        latitude: ip.latitude,
        longitude: ip.longitude,
        name: ip.name,
        source: 'ip',
        updatedAt: new Date().toISOString(),
        permissionDenied: true,
      })
      return toPublic(saved)
    },
  )
}
