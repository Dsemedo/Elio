import { BrowserWindow, ipcMain } from 'electron'
import {
  IpcChannels,
  TtsSetSettingsInputSchema,
  TtsSynthesizeInputSchema,
  type TtsSettings,
  type TtsSynthesizeResult,
} from '../../shared/ipc'
import { abortEdgeSynthesis, synthesizeEdgeMp3 } from '../services/tts/edgeTts'
import {
  effectiveEdgeVoice,
  effectiveTtsEnabled,
  effectiveTtsPreference,
  readTtsPrefsFile,
  writeTtsPrefsFile,
} from '../services/tts/prefs'

function hasEnvOverride(): boolean {
  return Boolean(
    process.env.ELIO_TTS_ENABLED?.trim() || process.env.ELIO_TTS_PROVIDER?.trim(),
  )
}

function toSettings(): TtsSettings {
  const file = readTtsPrefsFile()
  const enabled = effectiveTtsEnabled()
  const provider = effectiveTtsPreference()
  const edgeVoice = effectiveEdgeVoice()
  const envOverride = hasEnvOverride()
  let hint: string
  if (!enabled) {
    hint =
      'TTS desligado. Ative no menu da barra ou em Integrações para o Elio falar as respostas (pt-BR).'
  } else if (provider === 'system') {
    hint =
      'TTS system: usa vozes do Windows (speechSynthesis / SAPI). Offline. Instale voz pt-BR em Configurações → Hora e idioma → Fala.'
  } else if (provider === 'edge') {
    hint =
      'TTS edge-tts: voz neural Microsoft (precisa internet). Sem API key. Offline → use system ou auto.'
  } else {
    hint =
      'TTS auto: voz pt-BR do Windows se disponível; senão edge-tts (rede). Pare a fala pelo botão na barra.'
  }
  return {
    enabled,
    provider,
    edgeVoice: edgeVoice || file.edgeVoice,
    envOverride,
    hint,
  }
}

function broadcastSettings(): void {
  const settings = toSettings()
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IpcChannels.TTS_SETTINGS_CHANGED, settings)
  }
}

function friendlyTtsError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (message.startsWith('TTS_ABORTED')) return 'Fala interrompida'
  if (message.startsWith('TTS_EMPTY')) return 'Nada para falar'
  if (message.startsWith('TTS_TIMEOUT')) return 'TTS demorou demais — tente de novo'
  if (
    message.startsWith('TTS_EDGE_NETWORK') ||
    message.startsWith('TTS_EDGE_UNAVAILABLE')
  ) {
    return 'edge-tts precisa de internet. Use o provedor “system” (vozes do Windows) offline.'
  }
  if (message.startsWith('TTS_EDGE_')) {
    return 'Não foi possível sintetizar com edge-tts. Tente o TTS do Windows (system).'
  }
  return 'Falha no TTS. Você ainda pode ler a resposta em texto.'
}

export function registerTtsIpc(): void {
  ipcMain.handle(IpcChannels.TTS_GET_SETTINGS, (): TtsSettings => toSettings())

  ipcMain.handle(IpcChannels.TTS_SET_SETTINGS, (_event, raw: unknown): TtsSettings => {
    const input = TtsSetSettingsInputSchema.parse(raw)
    writeTtsPrefsFile({
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.provider !== undefined ? { provider: input.provider } : {}),
      ...(input.edgeVoice !== undefined ? { edgeVoice: input.edgeVoice } : {}),
    })
    const next = toSettings()
    broadcastSettings()
    return next
  })

  ipcMain.handle(
    IpcChannels.TTS_SYNTHESIZE,
    async (_event, raw: unknown): Promise<TtsSynthesizeResult> => {
      const input = TtsSynthesizeInputSchema.parse(raw)
      try {
        const result = await synthesizeEdgeMp3({
          text: input.text,
          voice: input.voice?.trim() || effectiveEdgeVoice(),
        })
        return result
      } catch (err) {
        throw new Error(friendlyTtsError(err))
      }
    },
  )

  ipcMain.handle(IpcChannels.TTS_STOP, (): { ok: boolean } => {
    abortEdgeSynthesis()
    return { ok: true }
  })
}
