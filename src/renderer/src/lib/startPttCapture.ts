/**
 * Inicia captura PTT: getUserMedia ANTES do SpeechRecognition.
 *
 * Ordem obrigatória (Electron/Chromium no Windows):
 * 1) getUserMedia — materializa permissão de mic e pode acionar o prompt do OS
 *    quando o acesso ainda não foi concedido (Privacidade → Microfone).
 * 2) SpeechRecognition — só depois do mic aberto.
 *
 * setPermissionRequestHandler no main libera o pedido Chromium (`media`);
 * isso NÃO substitui o consentimento do Windows. Sem getUserMedia, o Speech
 * costuma falhar com `not-allowed` sem nunca chegar na UI de permissão do OS.
 *
 * Permissão negada → erro (chip PT-BR). Whisper só após falha explícita do Speech
 * que NÃO seja permissão.
 */

import {
  extractWindowsSpeechErrorCode,
  isSpeechPermissionDenied,
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
 * Abre o mic (pedido real de permissão quando necessário), tenta Windows Speech.
 * - Mic/Speech com permissão negada → throw (UI mostra chip; sem Whisper silencioso).
 * - Outras falhas recuperáveis do Speech → captura Whisper com o mesmo recorder.
 */
export async function startWindowsSpeechPtt(opts?: {
  lang?: string
}): Promise<PttCapture> {
  // 1) Pedido de mic primeiro — único caminho que costuma acionar o prompt do Windows.
  const recorder = await startMicRecording()
  try {
    // 2) Speech só com mic já materializado.
    const session = await startWindowsSpeech({ lang: opts?.lang ?? 'pt-BR' })
    return { kind: 'windows-speech', session, recorder }
  } catch (err) {
    const code = extractWindowsSpeechErrorCode(
      err instanceof Error ? err.message : String(err),
    )
    if (isSpeechPermissionDenied(code)) {
      recorder.cancel()
      throw err
    }
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
