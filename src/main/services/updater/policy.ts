import { DISABLE_UPDATER_ENV, UPDATE_CHECK_INTERVAL_MS } from './constants'

export type UpdaterEnableInput = {
  isPackaged: boolean
  platform: NodeJS.Platform
  env?: NodeJS.ProcessEnv
}

/**
 * Auto-update só no app instalado (Windows).
 * Dev (`electron-vite`) e outras plataformas não consultam o feed.
 */
export function shouldEnableAutoUpdater(input: UpdaterEnableInput): boolean {
  const raw = input.env?.[DISABLE_UPDATER_ENV]?.trim().toLowerCase()
  if (raw === '1' || raw === 'true' || raw === 'yes') {
    return false
  }
  if (!input.isPackaged) {
    return false
  }
  return input.platform === 'win32'
}

export function getUpdateCheckIntervalMs(): number {
  return UPDATE_CHECK_INTERVAL_MS
}

/** Texto discreto da notificação após download (não força reinício). */
export function updateDownloadedNotification(version: string): {
  title: string
  body: string
} {
  return {
    title: 'Atualização do Elio',
    body: `Versão ${version} baixada. Feche e abra o Elio para instalar.`,
  }
}
