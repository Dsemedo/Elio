/**
 * Inicia captura PTT: getUserMedia ANTES do SpeechRecognition.
 *
 * No Electron/Chromium, SpeechRecognition costuma falhar com `not-allowed`
 * se a permissão de microfone ainda não foi materializada via getUserMedia,
 * mesmo com setPermissionRequestHandler concedendo `media`.
 */

import {
  extractWindowsSpeechErrorCode,
  shouldFallbackToWhisper,
} from '@shared/sttPolicy'
import { startMicRecording, type MicRecorder } from './recordWav'
import {
  startWindowsSpeech,
  type WindowsSpeechSession,
} from './windowsSpeech'

export type PttCapture =
  | {
      kind: 'windows-speech'
      session: WindowsSpeechSession
      /** WAV paralelo — sempre aberto quando speech sobe (mic-first). */
      recorder: MicRecorder
    }
  | {
      kind: 'whisper'
      recorder: MicRecorder
      /** Código Web Speech se caiu no Whisper por erro recuperável. */
      speechErrorCode?: string | null
    }

/**
 * Abre o mic, tenta Windows Speech; se Speech falhar de forma recuperável
 * (incl. not-allowed), devolve captura Whisper com o mesmo recorder.
 */
export async function startWindowsSpeechPtt(opts?: {
  lang?: string
}): Promise<PttCapture> {
  const recorder = await startMicRecording()
  try {
    const session = await startWindowsSpeech({ lang: opts?.lang ?? 'pt-BR' })
    return { kind: 'windows-speech', session, recorder }
  } catch (err) {
    const code = extractWindowsSpeechErrorCode(
      err instanceof Error ? err.message : String(err),
    )
    if (shouldFallbackToWhisper(code)) {
      return { kind: 'whisper', recorder, speechErrorCode: code }
    }
    recorder.cancel()
    throw err
  }
}

/** Só Whisper (Linux / force / sem SpeechRecognition). */
export async function startWhisperPtt(): Promise<PttCapture> {
  const recorder = await startMicRecording()
  return { kind: 'whisper', recorder }
}
