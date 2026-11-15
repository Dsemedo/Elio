/**
 * Política de perda de foco da shell (DS v1.1 §3.4 / feedback Douglas).
 *
 * Default: Floating Bar permanece acessível no desktop.
 * Command Center pode recolher; ocultar a barra só se o usuário pedir
 * (menu/bandeja) ou se ativar preferência futura hideBarOnBlur.
 */
export type FocusLossBehavior = 'keep-bar-hide-panel' | 'hide-all'

export type FocusLossPrefs = {
  /** Preferência futura; default false. */
  hideBarOnBlur?: boolean
}

export function resolveFocusLossBehavior(
  prefs: FocusLossPrefs = {},
): FocusLossBehavior {
  if (prefs.hideBarOnBlur === true) return 'hide-all'
  return 'keep-bar-hide-panel'
}
