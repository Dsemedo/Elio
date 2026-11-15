import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels, type AppInfo } from '../shared/ipc'

/**
 * Minimal preload: only expose typed, allow-listed APIs.
 * No Node globals leak into the renderer (contextIsolation + sandbox).
 */
const elioApi = {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IpcChannels.APP_GET_INFO),
}

export type ElioApi = typeof elioApi

contextBridge.exposeInMainWorld('elio', elioApi)
