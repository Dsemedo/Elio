import { BrowserWindow } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type FocusState = {
  /** Alguma janela do Elio está em foco (Electron). */
  elioFocused: boolean
  /**
   * Best-effort: processo em primeiro plano no Windows.
   * null = não disponível / não Windows / falha.
   */
  foregroundIsElio: boolean | null
  limitation: string
}

/**
 * Best-effort no Windows: pergunta ao user32 qual HWND está na frente
 * e compara com as janelas Electron do Elio.
 *
 * Limitações (documentar no README):
 * - Polling ~700ms; não é instantâneo.
 * - Depende de PowerShell; antivírus/políticas podem bloquear.
 * - Apps em fullscreen exclusivo / UAC / Secure Desktop podem falhar.
 * - Fora do Windows, só usamos blur/focus das BrowserWindows.
 */
export class FocusTracker {
  private timer: ReturnType<typeof setInterval> | null = null
  private last: FocusState = {
    elioFocused: true,
    foregroundIsElio: null,
    limitation:
      process.platform === 'win32'
        ? 'Foco no Windows é best-effort (polling + user32). Atalho global ainda é OD-20.'
        : 'Fora do Windows só detectamos foco das janelas do próprio Elio.',
  }
  private listeners = new Set<(state: FocusState) => void>()
  private ourPids = new Set<number>()

  start(getWindows: () => BrowserWindow[]): void {
    this.stop()
    this.refreshPids(getWindows())

    const tick = (): void => {
      void this.poll(getWindows())
    }
    tick()
    this.timer = setInterval(tick, 700)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  onChange(listener: (state: FocusState) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getState(): FocusState {
    return this.last
  }

  private refreshPids(windows: BrowserWindow[]): void {
    this.ourPids = new Set(
      windows
        .filter((w) => !w.isDestroyed())
        .map((w) => {
          try {
            return w.webContents.getOSProcessId()
          } catch {
            return process.pid
          }
        }),
    )
    this.ourPids.add(process.pid)
  }

  private emit(next: FocusState): void {
    const changed =
      next.elioFocused !== this.last.elioFocused ||
      next.foregroundIsElio !== this.last.foregroundIsElio
    this.last = next
    if (changed) {
      for (const listener of this.listeners) listener(next)
    }
  }

  private async poll(windows: BrowserWindow[]): Promise<void> {
    this.refreshPids(windows)
    const elioFocused = windows.some((w) => !w.isDestroyed() && w.isFocused())

    let foregroundIsElio: boolean | null = null
    if (process.platform === 'win32') {
      foregroundIsElio = await this.windowsForegroundIsOurs()
    }

    this.emit({
      elioFocused,
      foregroundIsElio,
      limitation: this.last.limitation,
    })
  }

  private async windowsForegroundIsOurs(): Promise<boolean | null> {
    const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class ElioFg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
}
"@
$h = [ElioFg]::GetForegroundWindow()
if ($h -eq [IntPtr]::Zero) { Write-Output "0"; exit 0 }
$pidOut = 0
[void][ElioFg]::GetWindowThreadProcessId($h, [ref]$pidOut)
Write-Output $pidOut
`.trim()

    try {
      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', script],
        { timeout: 1500, windowsHide: true, encoding: 'utf8' },
      )
      const pid = Number.parseInt(stdout.trim().split(/\r?\n/).pop() ?? '', 10)
      if (!Number.isFinite(pid) || pid <= 0) return null
      return this.ourPids.has(pid)
    } catch {
      return null
    }
  }
}
