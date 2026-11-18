import { describe, expect, it } from 'vitest'
import {
  resolveFocusLossBehavior,
  resolveShellForegroundAction,
} from '../src/main/shell/focusPolicy'
import { classifyForeground } from '../src/main/shell/foregroundKind'

describe('resolveFocusLossBehavior', () => {
  it('por padrão esconde tudo fora do desktop (segundo plano)', () => {
    expect(resolveFocusLossBehavior()).toBe('hide-all')
    expect(resolveFocusLossBehavior({})).toBe('hide-all')
  })

  it('keepBarOverApps restaura legado (barra sobre apps)', () => {
    expect(resolveFocusLossBehavior({ keepBarOverApps: true })).toBe(
      'keep-bar-hide-panel',
    )
  })

  it('legado hideBarOnBlur ainda funciona', () => {
    expect(resolveFocusLossBehavior({ hideBarOnBlur: true })).toBe('hide-all')
    expect(resolveFocusLossBehavior({ hideBarOnBlur: false })).toBe(
      'keep-bar-hide-panel',
    )
  })
})

describe('resolveShellForegroundAction', () => {
  it('mostra barra no Elio e na área de trabalho', () => {
    expect(resolveShellForegroundAction('elio')).toBe('show-bar')
    expect(resolveShellForegroundAction('desktop')).toBe('show-bar')
  })

  it('esconde tudo com outro app (default)', () => {
    expect(resolveShellForegroundAction('other')).toBe('hide-all')
  })

  it('com keepBarOverApps só recolhe o painel', () => {
    expect(
      resolveShellForegroundAction('other', { keepBarOverApps: true }),
    ).toBe('hide-panel-only')
  })

  it('unknown não age no poller', () => {
    expect(resolveShellForegroundAction('unknown')).toBe('noop')
  })
})

describe('classifyForeground', () => {
  const our = new Set([100, 200])

  it('reconhece PID do Elio', () => {
    expect(
      classifyForeground({ pid: 100, className: 'Chrome_WidgetWin_1', ourPids: our }),
    ).toBe('elio')
  })

  it('reconhece Progman/WorkerW como desktop', () => {
    expect(
      classifyForeground({ pid: 999, className: 'Progman', ourPids: our }),
    ).toBe('desktop')
    expect(
      classifyForeground({ pid: 999, className: 'WorkerW', ourPids: our }),
    ).toBe('desktop')
  })

  it('Explorer de pastas não é desktop', () => {
    expect(
      classifyForeground({
        pid: 999,
        className: 'CabinetWClass',
        ourPids: our,
      }),
    ).toBe('other')
  })

  it('app comum é other', () => {
    expect(
      classifyForeground({
        pid: 999,
        className: 'Chrome_WidgetWin_1',
        ourPids: our,
      }),
    ).toBe('other')
  })

  it('pid inválido é unknown', () => {
    expect(classifyForeground({ pid: 0, ourPids: our })).toBe('unknown')
    expect(classifyForeground({ pid: null, ourPids: our })).toBe('unknown')
  })
})
