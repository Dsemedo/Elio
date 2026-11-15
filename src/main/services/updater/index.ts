import { app } from 'electron'
// electron-updater é CJS; named import de autoUpdater quebra no main ESM
// (Node: "Named export 'autoUpdater' not found"). Default + destructure.
import electronUpdater from 'electron-updater'
import type { NsisUpdater } from 'electron-updater'
import { VERIFY_UPDATE_SIGNATURE } from './constants'
import {
  getUpdateCheckIntervalMs,
  shouldEnableAutoUpdater,
  updateDownloadedNotification,
} from './policy'

const { autoUpdater } = electronUpdater

let started = false
let intervalHandle: ReturnType<typeof setInterval> | null = null

function logUpdater(message: string, err?: unknown): void {
  if (err !== undefined) {
    console.warn(`[elio:updater] ${message}`, err)
    return
  }
  console.info(`[elio:updater] ${message}`)
}

/** Sem publisherName/cert, a verificação padrão falharia — no-op até assinar. */
function relaxWindowsSignatureCheckIfNeeded(): void {
  if (VERIFY_UPDATE_SIGNATURE || process.platform !== 'win32') {
    return
  }
  const nsis = autoUpdater as NsisUpdater
  nsis.verifyUpdateCodeSignature = async () => null
}

/**
 * Liga electron-updater → GitHub Releases.
 * Só em build empacotado Windows; falhas não derrubam o app.
 */
export function startAutoUpdater(): void {
  if (started) {
    return
  }
  started = true

  if (
    !shouldEnableAutoUpdater({
      isPackaged: app.isPackaged,
      platform: process.platform,
      env: process.env,
    })
  ) {
    logUpdater('desligado (dev ou plataforma ≠ win32)')
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false
  relaxWindowsSignatureCheckIfNeeded()

  autoUpdater.on('checking-for-update', () => {
    logUpdater('verificando GitHub Releases…')
  })
  autoUpdater.on('update-available', (info) => {
    logUpdater(`disponível: ${info.version}`)
  })
  autoUpdater.on('update-not-available', () => {
    logUpdater('já na última versão')
  })
  autoUpdater.on('error', (err) => {
    logUpdater('erro (ignorado; app segue)', err)
  })
  autoUpdater.on('update-downloaded', (info) => {
    const note = updateDownloadedNotification(info.version)
    logUpdater(`${note.title}: ${note.body}`)
  })

  const check = (): void => {
    void autoUpdater
      .checkForUpdatesAndNotify(updateDownloadedNotification('{version}'))
      .catch((err: unknown) => {
        logUpdater('check falhou', err)
      })
  }

  // Boot + a cada 4h (arquitetura §9). Atraso curto evita competir com o start da shell.
  setTimeout(check, 8_000)
  intervalHandle = setInterval(check, getUpdateCheckIntervalMs())
  intervalHandle.unref?.()
}

/** Só para testes — evita vazamento de timer se reimportado. */
export function stopAutoUpdaterForTests(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
  started = false
}
