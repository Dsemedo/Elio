import { describe, expect, it } from 'vitest'
import { resolveFocusLossBehavior } from '../src/main/shell/focusPolicy'

describe('resolveFocusLossBehavior', () => {
  it('por padrão mantém a barra e só recolhe o painel', () => {
    expect(resolveFocusLossBehavior()).toBe('keep-bar-hide-panel')
    expect(resolveFocusLossBehavior({})).toBe('keep-bar-hide-panel')
    expect(resolveFocusLossBehavior({ hideBarOnBlur: false })).toBe(
      'keep-bar-hide-panel',
    )
  })

  it('só esconde tudo se hideBarOnBlur estiver ativo', () => {
    expect(resolveFocusLossBehavior({ hideBarOnBlur: true })).toBe('hide-all')
  })
})
