/**
 * Automação leve de teclado (Estágio 2).
 *
 * Fatia 1: digitar (clipboard + Ctrl+V) + Enter/Tab/Esc.
 * Fatia 2: atalhos allowlisted (copiar, colar, selecionar tudo, desfazer, salvar, recortar).
 *
 * - Texto do usuário NUNCA entra no SendKeys.
 * - Scripts PowerShell fixos (sem interpolar input).
 * - Só Windows por enquanto.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const TYPE_TEXT_MAX_CHARS = 500

/** Teclas simples + atalhos Ctrl allowlist (sem Win/Alt/F4/arbitrário). */
export type AllowlistedKey =
  | 'enter'
  | 'tab'
  | 'escape'
  | 'copy'
  | 'paste'
  | 'cut'
  | 'select_all'
  | 'undo'
  | 'save'

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

const KEY_LABELS: Record<AllowlistedKey, string> = {
  enter: 'Enter',
  tab: 'Tab',
  escape: 'Esc',
  copy: 'Ctrl+C',
  paste: 'Ctrl+V',
  cut: 'Ctrl+X',
  select_all: 'Ctrl+A',
  undo: 'Ctrl+Z',
  save: 'Ctrl+S',
}

/** Aliases após “pressiona/aperta/tecla …”. */
const KEY_ALIASES: Record<AllowlistedKey, RegExp> = {
  enter: /^(?:enter|return|enviar|confirma)$/i,
  tab: /^(?:tab|tabula(?:ção|cao)?)$/i,
  escape: /^(?:esc|escape|sair)$/i,
  copy: /^(?:ctrl\s*\+\s*c|control\s*\+\s*c|ctrl\s+c|control\s+c|copiar|copia|copie)$/i,
  paste: /^(?:ctrl\s*\+\s*v|control\s*\+\s*v|ctrl\s+v|control\s+v|colar|cola|cole)$/i,
  cut: /^(?:ctrl\s*\+\s*x|control\s*\+\s*x|ctrl\s+x|control\s+x|recortar|recorta|recote)$/i,
  select_all:
    /^(?:ctrl\s*\+\s*a|control\s*\+\s*a|ctrl\s+a|control\s+a|selecionar\s+tudo|seleciona\s+tudo|selecione\s+tudo)$/i,
  undo: /^(?:ctrl\s*\+\s*z|control\s*\+\s*z|ctrl\s+z|control\s+z|desfazer|desfaz|desfaça|desfaca)$/i,
  save: /^(?:ctrl\s*\+\s*s|control\s*\+\s*s|ctrl\s+s|control\s+s|salvar|salva|salve)$/i,
}

/**
 * Frases PT-BR que são o comando inteiro (sem “pressiona”).
 * Ordem: mais específicas primeiro (seleciona tudo antes de verbos curtos).
 */
const STANDALONE_SHORTCUTS: Array<{ key: AllowlistedKey; pattern: RegExp }> = [
  {
    key: 'select_all',
    pattern:
      /^(?:por\s+favor\s+|pf\s+)?(?:seleciona|selecionar|selecione)\s+tudo(?:\s+(?:o\s+texto|isso|isto))?$/i,
  },
  {
    key: 'copy',
    pattern: /^(?:por\s+favor\s+|pf\s+)?(?:copia|copiar|copie)(?:\s+(?:isso|isto|o\s+texto))?$/i,
  },
  {
    key: 'paste',
    pattern: /^(?:por\s+favor\s+|pf\s+)?(?:cola|colar|cole)(?:\s+(?:isso|isto|aqui))?$/i,
  },
  {
    key: 'cut',
    pattern: /^(?:por\s+favor\s+|pf\s+)?(?:recorta|recortar|recote)(?:\s+(?:isso|isto|o\s+texto))?$/i,
  },
  {
    key: 'undo',
    pattern: /^(?:por\s+favor\s+|pf\s+)?(?:desfaz|desfazer|desfaça|desfaca)(?:\s+(?:isso|isto))?$/i,
  },
  {
    key: 'save',
    pattern:
      /^(?:por\s+favor\s+|pf\s+)?(?:salva|salvar|salve)(?:\s+(?:isso|isto|o\s+arquivo|arquivo))?$/i,
  },
]

/** Scripts PowerShell fixos — sem interpolar texto do usuário. */
const PS_PASTE =
  "Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 250; [System.Windows.Forms.SendKeys]::SendWait('^v')"

const PS_KEYS: Record<AllowlistedKey, string> = {
  enter:
    "Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 150; [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')",
  tab: "Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 150; [System.Windows.Forms.SendKeys]::SendWait('{TAB}')",
  escape:
    "Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 150; [System.Windows.Forms.SendKeys]::SendWait('{ESC}')",
  copy: "Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 150; [System.Windows.Forms.SendKeys]::SendWait('^c')",
  paste:
    "Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 150; [System.Windows.Forms.SendKeys]::SendWait('^v')",
  cut: "Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 150; [System.Windows.Forms.SendKeys]::SendWait('^x')",
  select_all:
    "Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 150; [System.Windows.Forms.SendKeys]::SendWait('^a')",
  undo: "Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 150; [System.Windows.Forms.SendKeys]::SendWait('^z')",
  save: "Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 150; [System.Windows.Forms.SendKeys]::SendWait('^s')",
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

function resolveStandaloneShortcut(text: string): AllowlistedKey | null {
  const cleaned = text.trim().replace(/[?.!]+$/g, '')
  for (const entry of STANDALONE_SHORTCUTS) {
    if (entry.pattern.test(cleaned)) return entry.key
  }
  return null
}

/**
 * Detecta “digite …”, “escreve …”, “pressiona enter”, “copia”, “ctrl+c”, etc.
 */
export function parseDesktopInputIntent(text: string): DesktopInputIntent | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  // Tecla/atalho allowlisted: “pressiona enter” / “aperta ctrl+c” / “tecla esc”
  const keyMatch = trimmed.match(
    /^(?:por\s+favor\s+|pf\s+)?(?:pressiona|pressionar|aperta|apertar|tecla)\b[\s,]+(.+)$/i,
  )
  if (keyMatch?.[1]) {
    const key = resolveKeyAlias(keyMatch[1])
    if (key) return { kind: 'press_key', key }
    return null
  }

  // Frases curtas: “copia”, “seleciona tudo”, “salva”, …
  const standalone = resolveStandaloneShortcut(trimmed)
  if (standalone) {
    return { kind: 'press_key', key: standalone }
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
    return `Pressionando ${KEY_LABELS[intent.key]}…`
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
 * Driver Windows: cola via clipboard + Ctrl+V; teclas/atalhos via SendKeys allowlist.
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

  // press_key (tecla simples ou atalho allowlist)
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
    return { ok: true, message: `Pressionei ${KEY_LABELS[intent.key]}.` }
  } catch (err) {
    const detail = err instanceof Error ? err.message.slice(0, 120) : 'erro'
    return {
      ok: false,
      message: `Não consegui pressionar a tecla (${detail}).`,
    }
  }
}
