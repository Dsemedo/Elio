import { ipcMain } from 'electron'
import {
  IpcChannels,
  SettingsOpenRouterKeyInputSchema,
  SettingsUpdateInputSchema,
  type DeleteAllDataResult,
  type UserDataExportPayload,
} from '../../shared/ipc'
import { ollamaProvider } from '../services/providers/ollama'
import {
  getOllamaHost,
  getPublicSettings,
  removeOpenRouterApiKey,
  setOpenRouterApiKey,
  updateLocalSettings,
} from '../services/settings'
import {
  buildUserDataExport,
  deleteAllUserData,
  exportUserDataJson,
} from '../services/userData'

export function registerSettingsIpc(): void {
  ipcMain.handle(IpcChannels.SETTINGS_GET, async () => getPublicSettings())

  ipcMain.handle(IpcChannels.SETTINGS_UPDATE, async (_event, raw: unknown) => {
    const patch = SettingsUpdateInputSchema.parse(raw ?? {})
    updateLocalSettings(patch)
    return getPublicSettings()
  })

  ipcMain.handle(IpcChannels.SETTINGS_SET_OPENROUTER_KEY, async (_event, raw: unknown) => {
    const { apiKey } = SettingsOpenRouterKeyInputSchema.parse(raw)
    const result = await setOpenRouterApiKey(apiKey)
    if (!result.ok) {
      throw new Error(result.reason)
    }
    // Não devolver a chave — só status público.
    return getPublicSettings()
  })

  ipcMain.handle(IpcChannels.SETTINGS_CLEAR_OPENROUTER_KEY, async () => {
    await removeOpenRouterApiKey()
    return getPublicSettings()
  })

  ipcMain.handle(IpcChannels.SETTINGS_PROBE_OLLAMA, async () => {
    const host = getOllamaHost()
    const ok = await ollamaProvider.isAvailable()
    return {
      ok,
      host,
      message: ok
        ? `Ollama respondendo em ${host}.`
        : `Ollama não detectado em ${host}. Abra o app Ollama e tente de novo.`,
    }
  })

  ipcMain.handle(IpcChannels.SETTINGS_EXPORT_DATA, (): UserDataExportPayload => {
    const data = buildUserDataExport()
    return {
      json: exportUserDataJson(),
      conversationCount: data.conversations.length,
      memoryCount: data.memories.length,
    }
  })

  ipcMain.handle(
    IpcChannels.SETTINGS_DELETE_ALL_DATA,
    (): DeleteAllDataResult => deleteAllUserData(),
  )
}
