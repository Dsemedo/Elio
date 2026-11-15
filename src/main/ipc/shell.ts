import { ipcMain } from 'electron'
import {
  IpcChannels,
  ShellBarOverlaySchema,
  ShellStateSchema,
  SystemSnapshotSchema,
  type ShellState,
} from '../../shared/ipc'
import { getSystemSnapshot } from '../services/systemInfo'
import { getShellManager } from '../shell/manager'

function currentState(): ShellState {
  const shell = getShellManager()
  const bar = shell.getBar()
  return ShellStateSchema.parse({
    panelOpen: shell.isPanelOpen(),
    barVisible: !!bar && !bar.isDestroyed() && bar.isVisible(),
    hiddenByFocus: shell.isHiddenByFocus(),
  })
}

export function registerShellIpc(): void {
  ipcMain.handle(IpcChannels.SHELL_GET_STATE, (): ShellState => currentState())

  ipcMain.handle(IpcChannels.SHELL_TOGGLE_PANEL, (): ShellState => {
    getShellManager().togglePanel()
    return currentState()
  })

  ipcMain.handle(IpcChannels.SHELL_OPEN_PANEL, (): ShellState => {
    getShellManager().openPanel()
    return currentState()
  })

  ipcMain.handle(IpcChannels.SHELL_CLOSE_PANEL, (): ShellState => {
    getShellManager().closePanel()
    return currentState()
  })

  ipcMain.handle(IpcChannels.SHELL_SHOW, (): ShellState => {
    getShellManager().showShell()
    return currentState()
  })

  ipcMain.handle(IpcChannels.SHELL_HIDE, (): ShellState => {
    getShellManager().hideShell()
    return currentState()
  })

  ipcMain.handle(IpcChannels.SHELL_SET_BAR_OVERLAY, (_event, raw: unknown) => {
    const { open } = ShellBarOverlaySchema.parse(raw)
    getShellManager().setBarOverlay(open)
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.SYSTEM_GET_SNAPSHOT, async () =>
    SystemSnapshotSchema.parse(await getSystemSnapshot()),
  )
}
