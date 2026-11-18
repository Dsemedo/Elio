import type { ForegroundKind } from './foregroundKind'

/**
 * Política de shell vs foco (DS §3.4 / feedback Douglas 2026-11-18).
 *
 * Default: Floating Bar só na área de trabalho (e no próprio Elio).
 * Com outro app em primeiro plano → some para a bandeja (segundo plano).
 * Preferência `keepBarOverApps` restaura o comportamento antigo
 * (barra always-on-top sobre apps; só recolhe o Command Center).
 */

export type FocusLossBehavior = 'keep-bar-hide-panel' | 'hide-all'

export type FocusLossPrefs = {
  /**
   * Se true, mantém a barra por cima de outros apps (legado ADR 0003 antigo).
   * Default false = some fora do desktop.
   */
  keepBarOverApps?: boolean
  /** @deprecated use keepBarOverApps invertido; mantido p/ compat de testes legados */
  hideBarOnBlur?: boolean
}

/** O que a shell deve fazer dado o primeiro plano atual. */
export type ShellForegroundAction = 'show-bar' | 'hide-all' | 'hide-panel-only' | 'noop'

export function resolveFocusLossBehavior(
  prefs: FocusLossPrefs = {},
): FocusLossBehavior {
  if (prefs.keepBarOverApps === true) return 'keep-bar-hide-panel'
  // Legado: hideBarOnBlur true → esconder tudo; false/undefined com keepBar…
  if (prefs.hideBarOnBlur === true) return 'hide-all'
  if (prefs.hideBarOnBlur === false) return 'keep-bar-hide-panel'
  return 'hide-all'
}

/**
 * Decide ação contínua (poller) a partir do kind de foreground.
 * - elio / desktop → mostrar barra (se estava escondida por foco)
 * - other → esconder tudo (default) ou só painel (keepBarOverApps)
 * - unknown → noop no poller (blur Electron ainda pode agir)
 */
export function resolveShellForegroundAction(
  kind: ForegroundKind,
  prefs: FocusLossPrefs = {},
): ShellForegroundAction {
  if (kind === 'elio' || kind === 'desktop') return 'show-bar'
  if (kind === 'unknown') return 'noop'

  const loss = resolveFocusLossBehavior(prefs)
  return loss === 'keep-bar-hide-panel' ? 'hide-panel-only' : 'hide-all'
}
