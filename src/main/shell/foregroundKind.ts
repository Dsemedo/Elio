/**
 * Classificação best-effort do HWND em primeiro plano (Windows).
 *
 * Regra de produto: a Floating Bar some só quando o usuário está
 * **usando um app visível**. Ambient / “entre apps” → barra volta.
 *
 * Conta como ambient (`desktop`):
 * - wallpaper (Progman / WorkerW)
 * - chrome do shell (bandeja, etc.)
 * - HWND em foco minimizado (IsIconic) — ex.: minimizar o último app
 *
 * Conta como app (`other`):
 * - janela visível não-minimizada de outro processo (Chrome, pasta Explorer…)
 */

export type ForegroundKind = 'elio' | 'desktop' | 'other' | 'unknown'

/** Wallpaper / desktop do explorer. */
export const DESKTOP_WINDOW_CLASSES = new Set(['Progman', 'WorkerW'])

/**
 * Chrome do shell Windows onde o usuário não está “dentro” de um app.
 * (Não incluir Windows.UI.Core.CoreWindow — UWP apps também usam.)
 */
export const SHELL_AMBIENT_CLASSES = new Set([
  'Shell_TrayWnd',
  'Shell_SecondaryTrayWnd',
  'NotifyIconOverflowWindow',
  'DV2ControlHost',
  'Shell_Flyout',
  'XamlExplorerHostIslandWindow',
])

export function isDesktopWindowClass(className: string | null | undefined): boolean {
  const c = (className ?? '').trim()
  return DESKTOP_WINDOW_CLASSES.has(c)
}

export function isShellAmbientClass(className: string | null | undefined): boolean {
  const c = (className ?? '').trim()
  return SHELL_AMBIENT_CLASSES.has(c)
}

export function classifyForeground(input: {
  pid: number | null
  className?: string | null
  /** true se o HWND em foco está minimizado (IsIconic). */
  iconic?: boolean | null
  ourPids: ReadonlySet<number>
}): ForegroundKind {
  const pid = input.pid
  if (pid == null || !Number.isFinite(pid) || pid <= 0) return 'unknown'
  if (input.ourPids.has(pid)) return 'elio'
  if (isDesktopWindowClass(input.className)) return 'desktop'
  if (isShellAmbientClass(input.className)) return 'desktop'
  // Minimizar o app em foco: Windows muitas vezes mantém o HWND
  // (ou vai pra bandeja). Em ambos os casos o usuário vê o desktop.
  if (input.iconic === true) return 'desktop'
  return 'other'
}
