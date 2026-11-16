/**
 * Inicia captura PTT: Whisper (primário / `auto`) ou Windows Speech (só force).
 *
 * Caminho Speech (ELIO_STT_PROVIDER=windows-speech):
 * 1) primeMicPermission — getUserMedia curto ou skip se já granted
 * 2) libera o device (stop tracks)
 * 3) SpeechRecognition sozinho — getUserMedia aberto em paralelo costuma
 *    deixar o Speech Runtime sem áudio no Electron/Windows
 */

import {
  extractWindowsSpeechErrorCode,
  isSpeechPermissionDenied,
  shouldFallbackToWhisper,
} from '@shared/sttPolicy'
import {
  primeMicPermission,
  startMicRecording,
  type MicRecorder,
} from './recordWav'
import {
  startWindowsSpeech,
  type WindowsSpeechSession,
} from './windowsSpeech'

export type PttCapture =
  | {
      kind: 'windows-speech'
      session: WindowsSpeechSession
    }
  | {
      kind: 'whisper'
      recorder: MicRecorder
      /** Código Web Speech se caiu no Whisper por erro ao iniciar. */
      speechErrorCode?: string | null
    }

/**
 * Caminho opcional (force windows-speech): permissão → libera device → Speech.
 * Falha recuperável no start → Whisper com recorder novo.
 */
export async function startWindowsSpeechPtt(opts?: {
  lang?: string
}): Promise<PttCapture> {
  await primeMicPermission()
  try {
    const session = await startWindowsSpeech({ lang: opts?.lang ?? 'pt-BR' })
    return { kind: 'windows-speech', session }
  } catch (err) {
    const code = extractWindowsSpeechErrorCode(
      err instanceof Error ? err.message : String(err),
    )
    if (isSpeechPermissionDenied(code)) {
      throw err
    }
    if (shouldFallbackToWhisper(code)) {
      const recorder = await startMicRecording()
      return { kind: 'whisper', recorder, speechErrorCode: code }
    }
    throw err
  }
}

/** Só Whisper (Linux / force / sem SpeechRecognition). */
export async function startWhisperPtt(): Promise<PttCapture> {
  const recorder = await startMicRecording()
  return { kind: 'whisper', recorder }
}
