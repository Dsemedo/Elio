import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import { z } from 'zod'

/**
 * Cache local de localização (só userData).
 * Nunca vai para o histórico de chat com coords precisas — só o nome da cidade
 * entra no enrich para o LLM.
 */

export const LocationSourceSchema = z.enum(['os', 'ip', 'manual'])
export type LocationSource = z.infer<typeof LocationSourceSchema>

export const CachedLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  /** Nome curto (cidade) — seguro para mostrar/enrich. */
  name: z.string().trim().min(1).max(120),
  source: LocationSourceSchema,
  updatedAt: z.string().datetime(),
  /** Se true, permissão OS foi negada (IP pode ter sido usado). */
  permissionDenied: z.boolean().optional(),
})

export type CachedLocation = z.infer<typeof CachedLocationSchema>

function cachePath(): string {
  return join(app.getPath('userData'), 'elio-location.json')
}

export function readCachedLocation(): CachedLocation | null {
  const path = cachePath()
  if (!existsSync(path)) return null
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown
    const parsed = CachedLocationSchema.safeParse(raw)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function writeCachedLocation(loc: CachedLocation): CachedLocation {
  const parsed = CachedLocationSchema.parse(loc)
  const path = cachePath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(parsed, null, 2), 'utf8')
  return parsed
}

export function clearCachedLocation(): void {
  const path = cachePath()
  if (!existsSync(path)) return
  try {
    writeFileSync(path, '', 'utf8')
  } catch {
    /* ignore */
  }
}
