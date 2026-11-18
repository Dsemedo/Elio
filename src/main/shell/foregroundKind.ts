/**
 * Classificação best-effort do HWND em primeiro plano (Windows).
 * Classes clássicas da área de trabalho: Progman / WorkerW (explorer).
 * Janela do Explorer (pastas) = CabinetWClass → conta como “outro app”.
 */

export type ForegroundKind = 'elio' | 'desktop' | 'other' | 'unknown'

/** Classes de HWND da wallpaper / desktop do explorer. */
export const DESKTOP_WINDOW_CLASSES = new Set(['Progman', 'WorkerW'])

export function isDesktopWindowClass(className: string | null | undefined): boolean {
  const c = (className ?? '').trim()
  return DESKTOP_WINDOW_CLASSES.has(c)
}

export function classifyForeground(input: {
  pid: number | null
  className?: string | null
  ourPids: ReadonlySet<number>
}): ForegroundKind {
  const pid = input.pid
  if (pid == null || !Number.isFinite(pid) || pid <= 0) return 'unknown'
  if (input.ourPids.has(pid)) return 'elio'
  if (isDesktopWindowClass(input.className)) return 'desktop'
  return 'other'
}
