import { app, Menu, ipcMain, session, type Session } from 'electron'
import { IpcChannels, type AppInfo } from '../shared/ipc'
import { registerChatIpc } from './ipc/chat'
import { registerLocationIpc } from './ipc/location'
import { registerMemoryIpc } from './ipc/memory'
import { registerSettingsIpc } from './ipc/settings'
import { registerShellIpc } from './ipc/shell'
import { registerSpotifyIpc } from './ipc/spotify'
import { registerVoiceIpc } from './ipc/voice'
import { isAppPermissionAllowed } from './sessionPermissions'
import { startAutoUpdater } from './services/updater'
import { getShellManager } from './shell/manager'

function registerIpc(): void {
  ipcMain.handle(IpcChannels.APP_GET_INFO, (): AppInfo => ({
    name: 'Elio',
    version: app.getVersion(),
    electron: process.versions.electron,
    platform: process.platform,
  }))
  registerChatIpc()
  registerVoiceIpc()
  registerShellIpc()
  registerLocationIpc()
  registerSpotifyIpc()
  registerSettingsIpc()
  registerMemoryIpc()
}

/**
 * Concede geolocation + media/mic ao origin do app.
 * O SO ainda pode mostrar o diálogo do Windows; sem isto o renderer recebe
 * PERMISSION_DENIED / SpeechRecognition `not-allowed` imediatamente.
 * (0.9 só liberava geolocation — isso bloqueava Web Speech / getUserMedia.)
 */
function allowAppMediaAndLocationPermissions(ses: Session): void {
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(isAppPermissionAllowed(permission))
  })
  ses.setPermissionCheckHandler((_wc, permission) => {
    return isAppPermissionAllowed(permission)
  })
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  allowAppMediaAndLocationPermissions(session.defaultSession)
  registerIpc()
  getShellManager().start()
  startAutoUpdater()

  app.on('activate', () => {
    getShellManager().showShell()
  })
})

app.on('window-all-closed', () => {
  // Barra/painel podem estar ocultos; a bandeja mantém o app vivo no Windows.
  // Só encerra no macOS clássico quando o usuário pede Sair pela bandeja.
  if (process.platform === 'darwin') {
    // no-op: mantém app com tray/activate
  }
})
