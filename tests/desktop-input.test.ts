import { describe, expect, it, vi } from 'vitest'
import {
  parseDesktopInputIntent,
  sanitizeTypeText,
  executeDesktopInputIntent,
  TYPE_TEXT_MAX_CHARS,
  type DesktopInputDriver,
} from '../src/main/services/tools/desktop/input'
import { classifyUserIntent } from '../src/main/services/tools/router'

describe('parseDesktopInputIntent', () => {
  it('reconhece digite / escreve', () => {
    expect(parseDesktopInputIntent('digite bom dia')).toEqual({
      kind: 'type_text',
      text: 'bom dia',
    })
    expect(parseDesktopInputIntent('escreve Olá, Douglas')).toEqual({
      kind: 'type_text',
      text: 'Olá, Douglas',
    })
    expect(parseDesktopInputIntent('por favor digitar teste')).toEqual({
      kind: 'type_text',
      text: 'teste',
    })
  })

  it('reconhece teclas allowlist', () => {
    expect(parseDesktopInputIntent('pressiona enter')).toEqual({
      kind: 'press_key',
      key: 'enter',
    })
    expect(parseDesktopInputIntent('aperta tab')).toEqual({
      kind: 'press_key',
      key: 'tab',
    })
    expect(parseDesktopInputIntent('tecla esc')).toEqual({
      kind: 'press_key',
      key: 'escape',
    })
  })

  it('reconhece atalhos Ctrl allowlist (pressiona + frases)', () => {
    expect(parseDesktopInputIntent('pressiona ctrl+c')).toEqual({
      kind: 'press_key',
      key: 'copy',
    })
    expect(parseDesktopInputIntent('aperta control v')).toEqual({
      kind: 'press_key',
      key: 'paste',
    })
    expect(parseDesktopInputIntent('tecla ctrl+a')).toEqual({
      kind: 'press_key',
      key: 'select_all',
    })
    expect(parseDesktopInputIntent('pressiona ctrl+z')).toEqual({
      kind: 'press_key',
      key: 'undo',
    })
    expect(parseDesktopInputIntent('pressiona ctrl+s')).toEqual({
      kind: 'press_key',
      key: 'save',
    })
    expect(parseDesktopInputIntent('pressiona ctrl+x')).toEqual({
      kind: 'press_key',
      key: 'cut',
    })

    expect(parseDesktopInputIntent('copia')).toEqual({
      kind: 'press_key',
      key: 'copy',
    })
    expect(parseDesktopInputIntent('cola')).toEqual({
      kind: 'press_key',
      key: 'paste',
    })
    expect(parseDesktopInputIntent('seleciona tudo')).toEqual({
      kind: 'press_key',
      key: 'select_all',
    })
    expect(parseDesktopInputIntent('desfaz')).toEqual({
      kind: 'press_key',
      key: 'undo',
    })
    expect(parseDesktopInputIntent('salva o arquivo')).toEqual({
      kind: 'press_key',
      key: 'save',
    })
    expect(parseDesktopInputIntent('recorta')).toEqual({
      kind: 'press_key',
      key: 'cut',
    })
  })

  it('não captura conversa geral, open nem atalho fora da allowlist', () => {
    expect(parseDesktopInputIntent('olá, tudo bem?')).toBeNull()
    expect(parseDesktopInputIntent('abre o Chrome')).toBeNull()
    expect(parseDesktopInputIntent('pressiona ctrl+w')).toBeNull()
    expect(parseDesktopInputIntent('pressiona alt+f4')).toBeNull()
    expect(parseDesktopInputIntent('copia isso pra mim depois')).toBeNull()
    expect(parseDesktopInputIntent('salva a conversa no histórico')).toBeNull()
  })
})

describe('sanitizeTypeText', () => {
  it('rejeita vazio e null byte', () => {
    expect(sanitizeTypeText('   ').ok).toBe(false)
    expect(sanitizeTypeText('a\0b').ok).toBe(false)
  })

  it('limita tamanho', () => {
    const long = 'x'.repeat(TYPE_TEXT_MAX_CHARS + 1)
    const r = sanitizeTypeText(long)
    expect(r.ok).toBe(false)
  })
})

describe('executeDesktopInputIntent', () => {
  it('fora do Windows explica a limitação', async () => {
    const r = await executeDesktopInputIntent(
      { kind: 'type_text', text: 'oi' },
      { platform: 'linux' },
    )
    expect(r.ok).toBe(false)
    expect(r.message.toLowerCase()).toMatch(/windows/)
  })

  it('usa o driver no Windows (texto nunca no SendKeys)', async () => {
    const typeText = vi.fn(async () => undefined)
    const pressKey = vi.fn(async () => undefined)
    const driver: DesktopInputDriver = { typeText, pressKey }

    const typed = await executeDesktopInputIntent(
      { kind: 'type_text', text: 'café com açúcar' },
      { platform: 'win32', driver },
    )
    expect(typed.ok).toBe(true)
    expect(typeText).toHaveBeenCalledWith('café com açúcar')
    expect(typed.message).toContain('café')

    const key = await executeDesktopInputIntent(
      { kind: 'press_key', key: 'enter' },
      { platform: 'win32', driver },
    )
    expect(key.ok).toBe(true)
    expect(pressKey).toHaveBeenCalledWith('enter')
  })

  it('executa atalho allowlist via driver', async () => {
    const typeText = vi.fn(async () => undefined)
    const pressKey = vi.fn(async () => undefined)
    const driver: DesktopInputDriver = { typeText, pressKey }

    const copy = await executeDesktopInputIntent(
      { kind: 'press_key', key: 'copy' },
      { platform: 'win32', driver },
    )
    expect(copy.ok).toBe(true)
    expect(copy.message).toContain('Ctrl+C')
    expect(pressKey).toHaveBeenCalledWith('copy')
  })
})

describe('classifyUserIntent — desktop_input', () => {
  it('lane A: digitar, tecla e atalho', () => {
    const digite = classifyUserIntent('digite bom dia')
    expect(digite.lane).toBe('pc_action')
    if (digite.lane === 'pc_action') {
      expect(digite.action).toBe('desktop_input')
      if (digite.action === 'desktop_input') {
        expect(digite.input).toEqual({ kind: 'type_text', text: 'bom dia' })
      }
    }

    const enter = classifyUserIntent('pressiona enter')
    expect(enter.lane).toBe('pc_action')
    if (enter.lane === 'pc_action') {
      expect(enter.action).toBe('desktop_input')
    }

    const copy = classifyUserIntent('copia')
    expect(copy.lane).toBe('pc_action')
    if (copy.lane === 'pc_action') {
      expect(copy.action).toBe('desktop_input')
      if (copy.action === 'desktop_input') {
        expect(copy.input).toEqual({ kind: 'press_key', key: 'copy' })
      }
    }
  })

  it('não rouba “abre …” para input', () => {
    const open = classifyUserIntent('abre a pasta Downloads')
    expect(open.lane).toBe('pc_action')
    if (open.lane === 'pc_action') {
      expect(open.action).toBe('desktop')
    }
  })
})
