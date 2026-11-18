import { BrowserWindow } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  classifyForeground,
  type ForegroundKind,
} from './foregroundKind'

const execFileAsync = promisify(execFile)

export type FocusState = {
  /** Alguma janela do Elio está em foco (Electron). */
  elioFocused: boolean
  /**
   * Best-effort: processo em primeiro plano no Windows.
   * null = não disponível / não Windows / falha.
   */
  foregroundIsElio: boolean | null
  /** Best-effort: elio | desktop | other | unknown. */
  foregroundKind: ForegroundKind
  limitation: string
}

/**
 * Best-effort no Windows: pergunta ao user32 qual HWND está na frente
 * e classifica (Elio / área de trabalho / outro app).
 *
 * Usado para:
 * - recolher o Command Center / esconder a barra fora do desktop
 * - restaurar a barra ao voltar à área de trabalho
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
    foregroundKind: 'elio',
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
      next.foregroundIsElio !== this.last.foregroundIsElio ||
      next.foregroundKind !== this.last.foregroundKind
    this.last = next
    if (changed) {
      for (const listener of this.listeners) listener(next)
    }
  }

  private async poll(windows: BrowserWindow[]): Promise<void> {
    this.refreshPids(windows)
    const elioFocused = windows.some((w) => !w.isDestroyed() && w.isFocused())

    let foregroundIsElio: boolean | null = null
    let foregroundKind: ForegroundKind = elioFocused ? 'elio' : 'unknown'

    if (process.platform === 'win32') {
      const sample = await this.windowsForegroundSample()
      if (sample) {
        foregroundKind = classifyForeground({
          pid: sample.pid,
          className: sample.className,
          ourPids: this.ourPids,
        })
        foregroundIsElio = foregroundKind === 'elio'
      } else {
        foregroundIsElio = null
        foregroundKind = elioFocused ? 'elio' : 'unknown'
      }
    } else if (!elioFocused) {
      // Fora do Windows não distinguimos desktop vs app.
      foregroundKind = 'other'
      foregroundIsElio = false
    }

    this.emit({
      elioFocused,
      foregroundIsElio,
      foregroundKind,
      limitation: this.last.limitation,
    })
  }

  private async windowsForegroundSample(): Promise<{
    pid: number
    className: string
  } | null> {
    const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class ElioFg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
}
"@
$h = [ElioFg]::GetForegroundWindow()
if ($h -eq [IntPtr]::Zero) { Write-Output "0\`t"; exit 0 }
$pidOut = 0
[void][ElioFg]::GetWindowThreadProcessId($h, [ref]$pidOut)
$sb = New-Object System.Text.StringBuilder 256
[void][ElioFg]::GetClassName($h, $sb, $sb.Capacity)
Write-Output ("{0}\`t{1}" -f $pidOut, $sb.ToString())
`.trim()

    try {
      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', script],
        { timeout: 1500, windowsHide: true, encoding: 'utf8' },
      )
      const line = stdout.trim().split(/\r?\n/).pop() ?? ''
      const [pidRaw, ...classParts] = line.split('\t')
      const pid = Number.parseInt(pidRaw ?? '', 10)
      if (!Number.isFinite(pid) || pid <= 0) return null
      return { pid, className: classParts.join('\t').trim() }
    } catch {
      return null
    }
  }
}
