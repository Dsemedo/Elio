/**
 * Constantes / helpers do rearme do Web Speech no PTT.
 * Isolados de DOM para testar no tsconfig.node.
 */

/** Delay antes de rearmar o Speech após onend (ms). Nunca 0 — start síncrono no onend falha no Chromium. */
export const SPEECH_RESTART_DELAY_MS = 150

/** Tempo para o OS liberar o device após track.stop() antes do Speech (ms). */
export const MIC_RELEASE_SETTLE_MS = 150

/** true se ainda devemos agendar restart (PTT ativo). */
export function shouldScheduleSpeechRestart(input: {
  settled: boolean
  stopping: boolean
}): boolean {
  return !input.settled && !input.stopping
}

/**
 * true se stop() pode resolver agora sem recognition.stop():
 * sessão já encerrou (ex.: no-speech) e o restart ainda não armou.
 */
export function canFinishSpeechStopWithoutEngine(input: {
  settled: boolean
  listening: boolean
}): boolean {
  return !input.settled && !input.listening
}
