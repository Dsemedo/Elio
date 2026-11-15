import { ipcMain } from 'electron'
import {
  IpcChannels,
  SettingsOpenRouterKeyInputSchema,
  SettingsUpdateInputSchema,
} from '../../shared/ipc'
import { ollamaProvider } from '../services/providers/ollama'
import {
  getOllamaHost,
  getPublicSettings,
  removeOpenRouterApiKey,
  setOpenRouterApiKey,
  updateLocalSettings,
} from '../services/settings'

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
}
