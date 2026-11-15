import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  nativeImage,
  screen,
  shell,
  type NativeImage,
} from 'electron'
import { join } from 'node:path'
import { IpcChannels } from '../../shared/channels'
import { FocusTracker } from './focusTracker'

const isDev = !app.isPackaged

export type ShellSurface = 'bar' | 'panel'

/**
 * Shell Fatia A: barrinha overlay (~20% largura) + painel completo.
 * - Barra always-on-top quando visível
 * - Clique na barra abre/fecha o painel
 * - Some (best-effort) quando outro app está em foco
 * - Volta via bandeja do sistema (atalho global = OD-20, ainda aberto)
 */
export class ShellManager {
  private bar: BrowserWindow | null = null
  private panel: BrowserWindow | null = null
  private tray: Tray | null = null
  private panelOpen = false
  private hiddenByFocus = false
  /**
   * Só esconde por foco depois que o usuário interagiu com o Elio.
   * Evita sumir na abertura enquanto o terminal/IDE ainda está na frente.
   */
  private engaged = false
  private blurHideTimer: ReturnType<typeof setTimeout> | null = null
  private readonly focus = new FocusTracker()
  private quitting = false

  start(): void {
    app.on('before-quit', () => {
      this.quitting = true
      this.focus.stop()
    })

    this.createBar()
    this.createPanel()
    this.createTray()
    this.focus.start(() => this.windows())
    this.focus.onChange((state) => this.onFocusChange(state))
  }

  getBar(): BrowserWindow | null {
    return this.bar
  }

  getPanel(): BrowserWindow | null {
    return this.panel
  }

  isPanelOpen(): boolean {
    return (
      this.panelOpen &&
      !!this.panel &&
      !this.panel.isDestroyed() &&
      this.panel.isVisible()
    )
  }

  isHiddenByFocus(): boolean {
    return this.hiddenByFocus
  }

  togglePanel(): void {
    if (this.isPanelOpen()) {
      this.closePanel()
    } else {
      this.openPanel()
    }
  }

  openPanel(): void {
    this.markEngaged()
    this.hiddenByFocus = false
    this.showBar()
    if (!this.panel || this.panel.isDestroyed()) {
      this.createPanel()
    }
    if (!this.panel) return
    this.panelOpen = true
    this.layoutPanel()
    this.panel.show()
    this.panel.focus()
    this.broadcastShellState()
  }

  closePanel(): void {
    this.panelOpen = false
    if (this.panel && !this.panel.isDestroyed()) {
      this.panel.hide()
    }
    this.broadcastShellState()
  }

  /** Mostra barra (e painel se estava aberto). Usado pela bandeja. */
  showShell(): void {
    this.markEngaged()
    this.hiddenByFocus = false
    this.showBar()
    if (this.panelOpen) {
      this.openPanel()
    } else {
      this.bar?.focus()
    }
    this.broadcastShellState()
  }

  private markEngaged(): void {
    this.engaged = true
  }

  hideShell(): void {
    this.clearBlurTimer()
    if (this.bar && !this.bar.isDestroyed()) this.bar.hide()
    if (this.panel && !this.panel.isDestroyed()) this.panel.hide()
    this.broadcastShellState()
  }

  private windows(): BrowserWindow[] {
    return [this.bar, this.panel].filter(
      (w): w is BrowserWindow => !!w && !w.isDestroyed(),
    )
  }

  private createBar(): void {
    // DS §3.2: pill 420×58, 12px do topo, centralizada.
    // Janela um pouco maior para sombra CSS sem clip.
    const { width: screenW } = screen.getPrimaryDisplay().workAreaSize
    const barW = 440
    const barH = 96
    const x = Math.round((screenW - barW) / 2)
    const y = 12

    this.bar = new BrowserWindow({
      width: barW,
      height: barH,
      x,
      y,
      minWidth: 360,
      maxWidth: 580,
      frame: false,
      transparent: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      show: false,
      title: 'Elio',
      backgroundColor: '#00000000',
      webPreferences: {
        preload: join(__dirname, '../preload/index.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })

    this.bar.setAlwaysOnTop(true, 'screen-saver')
    this.bar.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    this.attachCommon(this.bar)
    this.loadSurface(this.bar, 'bar')

    this.bar.on('ready-to-show', () => {
      if (!this.hiddenByFocus) this.bar?.showInactive()
    })

    this.bar.on('blur', () => this.scheduleHideIfUnfocused())
    this.bar.on('focus', () => {
      this.hiddenByFocus = false
      this.clearBlurTimer()
    })
    this.bar.on('closed', () => {
      this.bar = null
    })
  }

  private createPanel(): void {
    const work = screen.getPrimaryDisplay().workArea
    const width = Math.min(1080, Math.max(860, Math.round(work.width * 0.72)))
    const height = Math.min(740, Math.max(560, Math.round(work.height * 0.78)))
    const x = Math.round(work.x + (work.width - width) / 2)
    const y = Math.round(work.y + Math.max(56, (work.height - height) / 2))

    this.panel = new BrowserWindow({
      width,
      height,
      x,
      y,
      minWidth: 800,
      minHeight: 520,
      show: false,
      title: 'Elio',
      backgroundColor: '#0c1222',
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })

    this.attachCommon(this.panel)
    this.loadSurface(this.panel, 'panel')

    this.panel.on('close', (event) => {
      if (this.quitting) return
      event.preventDefault()
      this.closePanel()
    })
    this.panel.on('blur', () => this.scheduleHideIfUnfocused())
    this.panel.on('focus', () => {
      this.hiddenByFocus = false
      this.clearBlurTimer()
    })
    this.panel.on('closed', () => {
      this.panel = null
      this.panelOpen = false
    })
  }

  private layoutPanel(): void {
    if (!this.panel || this.panel.isDestroyed()) return
    const work = screen.getPrimaryDisplay().workArea
    const { width, height } = this.panel.getBounds()
    const x = Math.round(work.x + (work.width - width) / 2)
    const y = Math.round(work.y + Math.max(56, (work.height - height) / 2))
    this.panel.setPosition(x, y, false)
  }

  private showBar(): void {
    if (!this.bar || this.bar.isDestroyed()) {
      this.createBar()
    }
    this.bar?.showInactive()
  }

  private attachCommon(win: BrowserWindow): void {
    win.webContents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url)
      return { action: 'deny' }
    })

    win.webContents.on('will-navigate', (event, url) => {
      const allowed = isDev
        ? url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')
        : url.startsWith('file://')
      if (!allowed) event.preventDefault()
    })

    win.webContents.on('did-fail-load', (_event, code, desc, url) => {
      console.error('[elio] falha ao carregar UI', { code, desc, url })
    })
  }

  private loadSurface(win: BrowserWindow, surface: ShellSurface): void {
    if (isDev && process.env['ELECTRON_RENDERER_URL']) {
      const base = process.env['ELECTRON_RENDERER_URL'].replace(/\/$/, '')
      void win.loadURL(`${base}/?surface=${surface}`)
    } else {
      void win.loadFile(join(__dirname, '../renderer/index.html'), {
        query: { surface },
      })
    }
  }

  private createTray(): void {
    const icon = this.trayIcon()
    this.tray = new Tray(icon)
    this.tray.setToolTip('Elio')
    const menu = Menu.buildFromTemplate([
      {
        label: 'Mostrar Elio',
        click: () => this.showShell(),
      },
      {
        label: 'Abrir / fechar painel',
        click: () => {
          this.showShell()
          this.togglePanel()
        },
      },
      { type: 'separator' },
      {
        label: 'Sair',
        click: () => {
          this.quitting = true
          app.quit()
        },
      },
    ])
    this.tray.setContextMenu(menu)
    this.tray.on('click', () => this.showShell())
  }

  private trayIcon(): NativeImage {
    const candidates = [
      join(process.cwd(), 'resources', 'tray-icon.png'),
      join(process.resourcesPath, 'tray-icon.png'),
      join(app.getAppPath(), 'resources', 'tray-icon.png'),
    ]
    for (const path of candidates) {
      const img = nativeImage.createFromPath(path)
      if (!img.isEmpty()) return img
    }
    const size = 16
    const buf = Buffer.alloc(size * size * 4)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4
        const cx = x - 7.5
        const cy = y - 7.5
        if (cx * cx + cy * cy <= 36) {
          // BGRA (bitmap Electron)
          buf[i] = 197
          buf[i + 1] = 224
          buf[i + 2] = 94
          buf[i + 3] = 255
        }
      }
    }
    return nativeImage.createFromBitmap(buf, { width: size, height: size })
  }

  private scheduleHideIfUnfocused(): void {
    this.clearBlurTimer()
    // Debounce: clique barra→painel / troca entre janelas do Elio.
    this.blurHideTimer = setTimeout(() => {
      if (!this.engaged || this.quitting) return
      const anyFocused = this.windows().some((w) => w.isFocused())
      if (anyFocused) return

      const fg = this.focus.getState().foregroundIsElio
      // Windows: some se FG não é Elio. Se FG desconhecido, some no blur (best-effort).
      if (process.platform === 'win32' && fg === true) return

      this.hiddenByFocus = true
      this.hideShell()
    }, 280)
  }

  private onFocusChange(state: {
    elioFocused: boolean
    foregroundIsElio: boolean | null
  }): void {
    if (this.quitting) return

    if (state.elioFocused) {
      this.markEngaged()
      this.hiddenByFocus = false
      this.clearBlurTimer()
      return
    }

    // Só esconde via polling depois que o usuário já usou o Elio.
    if (
      this.engaged &&
      process.platform === 'win32' &&
      state.foregroundIsElio === false &&
      !state.elioFocused
    ) {
      this.hiddenByFocus = true
      this.hideShell()
    }
  }

  private clearBlurTimer(): void {
    if (this.blurHideTimer) {
      clearTimeout(this.blurHideTimer)
      this.blurHideTimer = null
    }
  }

  private broadcastShellState(): void {
    const payload = {
      panelOpen: this.isPanelOpen(),
      barVisible: !!this.bar && !this.bar.isDestroyed() && this.bar.isVisible(),
      hiddenByFocus: this.hiddenByFocus,
    }
    for (const win of this.windows()) {
      win.webContents.send(IpcChannels.SHELL_STATE_CHANGED, payload)
    }
  }
}

let singleton: ShellManager | null = null

export function getShellManager(): ShellManager {
  if (!singleton) singleton = new ShellManager()
  return singleton
}
