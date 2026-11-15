/**
 * Helpers puros de scroll do chat — testáveis sem Electron/DOM real.
 */

/** Distância (px) do fundo considerada “ainda no final”. */
export const NEAR_BOTTOM_PX = 96

export function distanceFromBottom(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
): number {
  return Math.max(0, scrollHeight - clientHeight - scrollTop)
}

export function isNearBottom(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  threshold = NEAR_BOTTOM_PX,
): boolean {
  return distanceFromBottom(scrollTop, clientHeight, scrollHeight) <= threshold
}

/**
 * Auto-rolar ao fundo quando:
 * - o usuário já estava perto do fim, ou
 * - houve ação própria (envio / thinking) que deve fixar no fim.
 * Não força se o usuário rolou para cima lendo histórico.
 */
export function shouldAutoScrollToBottom(opts: {
  wasNearBottom: boolean
  forceStick: boolean
}): boolean {
  return opts.forceStick || opts.wasNearBottom
}
