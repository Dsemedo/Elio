/**
 * Automação leve de teclado (Estágio 2 — fatia 1).
 *
 * - Digitar: clipboard do Electron + Ctrl+V (texto NUNCA passa pelo SendKeys).
 * - Teclas: allowlist fixa (Enter / Tab / Esc) via SendKeys com script fixo.
 * - Só Windows por enquanto.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const TYPE_TEXT_MAX_CHARS = 500

export type AllowlistedKey = 'enter' | 'tab' | 'escape'

export type DesktopInputIntent =
  | { kind: 'type_text'; text: string }
  | { kind: 'press_key'; key: AllowlistedKey }

export type DesktopInputDriver = {
  typeText: (text: string) => Promise<void>
  pressKey: (key: AllowlistedKey) => Promise<void>
}

export type DesktopInputResult = {
  ok: boolean
  message: string
}

const TYPE_VERB =
  /^(?:por\s+favor\s+|pf\s+)?(?:digite|digitar|digita|escreva|escreve|escrever)\b[\s,:]*/i

const KEY_ALIASES: Record<AllowlistedKey, RegExp> = {
  enter: /^(?:enter|return|enviar|confirma)$/i,
  tab: /^(?:tab|tabula(?:ção|cao)?)$/i,
  escape: /^(?:esc|escape|sair)$/i,
}

/** Scripts PowerShell fixos — sem interpolar texto do usuário. */
const PS_PASTE =
  "Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 250; [System.Windows.Forms.SendKeys]::SendWait('^v')"

const PS_KEYS: Record<AllowlistedKey, string> = {
  enter:
    "Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 150; [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')",
  tab: "Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 150; [System.Windows.Forms.SendKeys]::SendWait('{TAB}')",
  escape:
    "Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 150; [System.Windows.Forms.SendKeys]::SendWait('{ESC}')",
}

export function sanitizeTypeText(raw: string): { ok: true; text: string } | { ok: false; reason: string } {
  if (raw.includes('\0')) {
    return { ok: false, reason: 'Texto inválido.' }
  }
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!text) {
    return { ok: false, reason: 'Não entendi o que digitar. Ex.: “digite bom dia”.' }
  }
  if (text.length > TYPE_TEXT_MAX_CHARS) {
    return {
      ok: false,
      reason: `Texto longo demais (máx. ${TYPE_TEXT_MAX_CHARS} caracteres).`,
    }
  }
  return { ok: true, text }
}

function resolveKeyAlias(raw: string): AllowlistedKey | null {
  const cleaned = raw.trim().replace(/[?.!]+$/g, '')
  for (const key of Object.keys(KEY_ALIASES) as AllowlistedKey[]) {
    if (KEY_ALIASES[key].test(cleaned)) return key
  }
  return null
}

/**
 * Detecta “digite …”, “escreve …”, “pressiona enter”, etc.
 */
export function parseDesktopInputIntent(text: string): DesktopInputIntent | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  // Tecla allowlisted: “pressiona enter” / “aperta tab” / “tecla esc”
  const keyMatch = trimmed.match(
    /^(?:por\s+favor\s+|pf\s+)?(?:pressiona|pressionar|aperta|apertar|tecla)\b[\s,]+(.+)$/i,
  )
  if (keyMatch?.[1]) {
    const key = resolveKeyAlias(keyMatch[1])
    if (key) return { kind: 'press_key', key }
    return null
  }

  if (!TYPE_VERB.test(trimmed)) return null
  const rest = trimmed.replace(TYPE_VERB, '').trim()
  const sanitized = sanitizeTypeText(rest)
  if (!sanitized.ok) {
    // Verb claro mas texto vazio/inválido — ainda é intent (exec devolve a razão).
    return { kind: 'type_text', text: '' }
  }
  return { kind: 'type_text', text: sanitized.text }
}

export function describeInputIntent(intent: DesktopInputIntent): string {
  if (intent.kind === 'press_key') {
    const labels: Record<AllowlistedKey, string> = {
      enter: 'Enter',
      tab: 'Tab',
      escape: 'Esc',
    }
    return `Pressionando ${labels[intent.key]}…`
  }
  const preview =
    intent.text.length > 40 ? `${intent.text.slice(0, 40)}…` : intent.text
  return preview ? `Digitando “${preview}”…` : 'Digitando…'
}

async function runFixedPowerShell(script: string): Promise<void> {
  await execFileAsync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script,
    ],
    {
      windowsHide: true,
      timeout: 8_000,
      shell: false,
    },
  )
}

export type ClipboardPort = {
  readText: () => string | Promise<string>
  writeText: (text: string) => void | Promise<void>
}

/**
 * Driver Windows: cola via clipboard + Ctrl+V; teclas via SendKeys allowlist.
 */
export function createWindowsInputDriver(
  clipboard: ClipboardPort,
): DesktopInputDriver {
  return {
    typeText: async (text: string) => {
      const previous = await Promise.resolve(clipboard.readText())
      try {
        await Promise.resolve(clipboard.writeText(text))
        await runFixedPowerShell(PS_PASTE)
      } finally {
        // Melhor esforço: restaura clipboard anterior (pode falhar se mudou).
        try {
          await Promise.resolve(clipboard.writeText(previous))
        } catch {
          /* ignore */
        }
      }
    },
    pressKey: async (key: AllowlistedKey) => {
      await runFixedPowerShell(PS_KEYS[key])
    },
  }
}

export async function executeDesktopInputIntent(
  intent: DesktopInputIntent,
  opts?: {
    platform?: NodeJS.Platform
    driver?: DesktopInputDriver
  },
): Promise<DesktopInputResult> {
  const platform = opts?.platform ?? process.platform

  if (intent.kind === 'type_text') {
    const sanitized = sanitizeTypeText(intent.text)
    if (!sanitized.ok) {
      return { ok: false, message: sanitized.reason }
    }
    if (platform !== 'win32') {
      return {
        ok: false,
        message:
          'Digitar no app em foco só está disponível no Windows por enquanto.',
      }
    }
    const driver = opts?.driver
    if (!driver) {
      return { ok: false, message: 'Driver de teclado indisponível.' }
    }
    try {
      await driver.typeText(sanitized.text)
      const preview =
        sanitized.text.length > 60
          ? `${sanitized.text.slice(0, 60)}…`
          : sanitized.text
      return {
        ok: true,
        message: `Digitei no app em foco: “${preview}”.`,
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message.slice(0, 120) : 'erro'
      return {
        ok: false,
        message: `Não consegui digitar no app em foco (${detail}). Clique no campo e tente de novo.`,
      }
    }
  }

  // press_key
  if (platform !== 'win32') {
    return {
      ok: false,
      message: 'Teclas do teclado só estão disponíveis no Windows por enquanto.',
    }
  }
  const driver = opts?.driver
  if (!driver) {
    return { ok: false, message: 'Driver de teclado indisponível.' }
  }
  try {
    await driver.pressKey(intent.key)
    const labels: Record<AllowlistedKey, string> = {
      enter: 'Enter',
      tab: 'Tab',
      escape: 'Esc',
    }
    return { ok: true, message: `Pressionei ${labels[intent.key]}.` }
  } catch (err) {
    const detail = err instanceof Error ? err.message.slice(0, 120) : 'erro'
    return {
      ok: false,
      message: `Não consegui pressionar a tecla (${detail}).`,
    }
  }
}
