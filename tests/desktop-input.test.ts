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

  it('não captura conversa geral nem open', () => {
    expect(parseDesktopInputIntent('olá, tudo bem?')).toBeNull()
    expect(parseDesktopInputIntent('abre o Chrome')).toBeNull()
    expect(parseDesktopInputIntent('pressiona ctrl+c')).toBeNull()
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
})

describe('classifyUserIntent — desktop_input', () => {
  it('lane A: digitar e tecla', () => {
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
  })

  it('não rouba “abre …” para input', () => {
    const open = classifyUserIntent('abre a pasta Downloads')
    expect(open.lane).toBe('pc_action')
    if (open.lane === 'pc_action') {
      expect(open.action).toBe('desktop')
    }
  })
})
