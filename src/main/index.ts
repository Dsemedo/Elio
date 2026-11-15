import { app, Menu, ipcMain } from 'electron'
import { IpcChannels, type AppInfo } from '../shared/ipc'
import { registerChatIpc } from './ipc/chat'
import { registerShellIpc } from './ipc/shell'
import { registerVoiceIpc } from './ipc/voice'
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
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  registerIpc()
  getShellManager().start()

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
