/**
 * Estado de acesso ao microfone no SO (Windows/macOS).
 * No Windows não há askForMediaAccess — o prompt (quando existe) vem do
 * getUserMedia no renderer, desde que a sessão Electron conceda `media`.
 */

import { systemPreferences } from 'electron'
import type { MicAccessSnapshot, MicAccessStatusValue } from '../shared/types'

const KNOWN = new Set<MicAccessStatusValue>([
  'not-determined',
  'granted',
  'denied',
  'restricted',
  'unknown',
])

export function readMicAccessStatus(
  platform: NodeJS.Platform = process.platform,
): MicAccessSnapshot {
  if (platform !== 'win32' && platform !== 'darwin') {
    return { status: 'unknown', platform }
  }
  try {
    const raw = systemPreferences.getMediaAccessStatus('microphone')
    const status = KNOWN.has(raw as MicAccessStatusValue)
      ? (raw as MicAccessStatusValue)
      : 'unknown'
    return { status, platform }
  } catch {
    return { status: 'unknown', platform }
  }
}
