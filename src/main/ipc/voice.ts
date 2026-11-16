import { BrowserWindow, ipcMain } from 'electron'
import {
  IpcChannels,
  VoiceTranscribeInputSchema,
  type VoiceStatus,
} from '../../shared/ipc'
import { readMicAccessStatus } from '../micAccess'
import { WHISPER_RELEASE, resolveWhisperModel } from '../services/voice/constants'
import { ensureVoiceAssets, voiceAssetsStatus } from '../services/voice/download'
import { friendlyVoiceError, logVoiceError } from '../services/voice/errors'
import { readSttPreferenceFromEnv } from '../services/voice/sttPreference'
import { transcribeWavBase64 } from '../services/voice/transcribe'
import type { MicAccessSnapshot, VoiceProgress } from '../../shared/types'

function broadcastProgress(progress: VoiceProgress): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IpcChannels.VOICE_PROGRESS, progress)
  }
}

function toVoiceStatus(): VoiceStatus {
  const assets = voiceAssetsStatus()
  const model = resolveWhisperModel()
  const sttPreference = readSttPreferenceFromEnv()
  const onWindows = process.platform === 'win32'
  return {
    ready: assets.ready,
    binaryReady: assets.binaryReady,
    modelReady: assets.modelReady,
    modelId: model.id,
    whisperVersion: WHISPER_RELEASE,
    supported:
      process.platform === 'win32' || process.platform === 'linux',
    sttPreference,
    platform: process.platform,
    hint: assets.ready
      ? onWindows
        ? 'Voz pronta (Whisper local). Windows Speech só com ELIO_STT_PROVIDER=windows-speech.'
        : 'Voz pronta (Whisper local) — segure o microfone e fale.'
      : `Na primeira vez a gente baixa o Whisper (~${model.sizeHintMb} MB, modelo ${model.id}). Precisa de internet uma vez.`,
  }
}

export function registerVoiceIpc(): void {
  ipcMain.handle(IpcChannels.VOICE_GET_STATUS, (): VoiceStatus => toVoiceStatus())

  ipcMain.handle(
    IpcChannels.VOICE_GET_MIC_ACCESS,
    (): MicAccessSnapshot => readMicAccessStatus(),
  )

  ipcMain.handle(IpcChannels.VOICE_ENSURE, async () => {
    try {
      await ensureVoiceAssets(broadcastProgress)
      return toVoiceStatus()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'DOWNLOAD_FAILED'
      logVoiceError('voice:ensure falhou', err)
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
      logVoiceError('voice:transcribe falhou', err)
      throw new Error(friendlyVoiceError(message))
    }
  })
}
