/** Janela curta para conferir/editar o transcript antes do auto-envio. */
export const VOICE_CONFIRM_MS = 2_800

export type VoiceConfirmController = {
  /** Cancela o timer (edição / Esc / Desfazer). */
  cancel: () => void
  /** True se o auto-envio ainda está armado. */
  isArmed: () => boolean
}

/**
 * Agenda auto-envio; cancela se `cancel()` for chamado antes.
 * Edição do texto deve cancelar (usuário confirma com Enter).
 */
export function armVoiceConfirmSend(
  onFire: () => void,
  delayMs = VOICE_CONFIRM_MS,
): VoiceConfirmController {
  let armed = true
  const timer = globalThis.setTimeout(() => {
    if (!armed) return
    armed = false
    onFire()
  }, delayMs)

  return {
    cancel: () => {
      armed = false
      globalThis.clearTimeout(timer)
    },
    isArmed: () => armed,
  }
}
