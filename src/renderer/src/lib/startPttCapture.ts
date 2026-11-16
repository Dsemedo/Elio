/**
 * Inicia captura PTT para Windows Speech (primário) ou Whisper (fallback).
 *
 * Ordem no Windows (Electron/Chromium):
 * 1) primeMicPermission — se mic já granted, skip; senão getUserMedia curto,
 *    libera tracks e espera settle antes do Speech
 * 2) SpeechRecognition sozinho — getUserMedia aberto em paralelo costuma
 *    deixar o Speech Runtime sem áudio (“não ouvi nada”)
 * 3) No hold, no-speech/onend rearmam o Speech com delay (nunca start síncrono
 *    no onend — quirk Chromium)
 *
 * Whisper só se o Speech falhar ao **iniciar** (rede/áudio/indisponível).
 * Sem WAV paralelo nesta fala: no-speech → pedir para falar de novo.
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
 * Permissão de mic → libera device → Windows Speech.
 * Falha recuperável no start do Speech → Whisper com recorder novo.
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
