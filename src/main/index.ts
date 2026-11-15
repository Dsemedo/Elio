import { app, BrowserWindow, Menu, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { IpcChannels, type AppInfo } from '../shared/ipc'
import { registerChatIpc } from './ipc/chat'

const isDev = !app.isPackaged

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 560,
    show: false,
    title: 'Elio',
    backgroundColor: '#0c1222',
    autoHideMenuBar: true,
    webPreferences: {
      // CJS: sandboxed preload cannot load ESM (.mjs) — see electron.vite.config.ts
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.on('did-fail-load', (_event, code, desc, url) => {
    console.error('[elio] falha ao carregar UI', { code, desc, url })
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev
      ? url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')
      : url.startsWith('file://')
    if (!allowed) {
      event.preventDefault()
    }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function registerIpc(): void {
  ipcMain.handle(IpcChannels.APP_GET_INFO, (): AppInfo => ({
    name: 'Elio',
    version: app.getVersion(),
    electron: process.versions.electron,
    platform: process.platform,
  }))
  registerChatIpc()
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
