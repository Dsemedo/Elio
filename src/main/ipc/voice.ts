import { BrowserWindow, ipcMain } from 'electron'
import {
  IpcChannels,
  VoiceTranscribeInputSchema,
  type VoiceStatus,
} from '../../shared/ipc'
import { MODEL_ID, WHISPER_RELEASE } from '../services/voice/constants'
import { ensureVoiceAssets, voiceAssetsStatus } from '../services/voice/download'
import { friendlyVoiceError } from '../services/voice/errors'
import { transcribeWavBase64 } from '../services/voice/transcribe'
import type { VoiceProgress } from '../../shared/types'

function broadcastProgress(progress: VoiceProgress): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IpcChannels.VOICE_PROGRESS, progress)
  }
}

function toVoiceStatus(): VoiceStatus {
  const assets = voiceAssetsStatus()
  return {
    ready: assets.ready,
    binaryReady: assets.binaryReady,
    modelReady: assets.modelReady,
    modelId: MODEL_ID,
    whisperVersion: WHISPER_RELEASE,
    supported:
      process.platform === 'win32' || process.platform === 'linux',
    hint: assets.ready
      ? 'Voz pronta — segure o microfone e fale.'
      : 'Na primeira vez a gente baixa o Whisper (~80 MB). Precisa de internet uma vez.',
  }
}

export function registerVoiceIpc(): void {
  ipcMain.handle(IpcChannels.VOICE_GET_STATUS, (): VoiceStatus => toVoiceStatus())

  ipcMain.handle(IpcChannels.VOICE_ENSURE, async () => {
    try {
      await ensureVoiceAssets(broadcastProgress)
      return toVoiceStatus()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'DOWNLOAD_FAILED'
      console.error('[elio] voice:ensure falhou')
      throw new Error(friendlyVoiceError(message))
    }
  })

  ipcMain.handle(IpcChannels.VOICE_TRANSCRIBE, async (_event, raw: unknown) => {
    const input = VoiceTranscribeInputSchema.parse(raw)
    try {
      const result = await transcribeWavBase64(input.audioBase64, broadcastProgress)
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'TRANSCRIBE_FAILED'
      console.error('[elio] voice:transcribe falhou')
      throw new Error(friendlyVoiceError(message))
    }
  })
}
