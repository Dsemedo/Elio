import { describe, expect, it } from 'vitest'
import { IpcChannels, ShellStateSchema, SystemSnapshotSchema } from '../src/shared/ipc'

describe('shell IPC schemas', () => {
  it('expõe canais da shell e do sistema', () => {
    expect(IpcChannels.SHELL_TOGGLE_PANEL).toBe('shell:togglePanel')
    expect(IpcChannels.SHELL_STATE_CHANGED).toBe('shell:stateChanged')
    expect(IpcChannels.SYSTEM_GET_SNAPSHOT).toBe('system:getSnapshot')
  })

  it('valida ShellState', () => {
    const parsed = ShellStateSchema.parse({
      panelOpen: true,
      barVisible: true,
      hiddenByFocus: false,
    })
    expect(parsed.panelOpen).toBe(true)
  })

  it('rejeita ShellState inválido', () => {
    expect(() =>
      ShellStateSchema.parse({
        panelOpen: 'yes',
        barVisible: true,
        hiddenByFocus: false,
      }),
    ).toThrow()
  })

  it('valida SystemSnapshot mínimo', () => {
    const parsed = SystemSnapshotSchema.parse({
      platform: 'win32',
      release: '10.0.0',
      arch: 'x64',
      hostname: 'pc',
      uptimeSec: 120,
      totalMemBytes: 8_000_000_000,
      freeMemBytes: 2_000_000_000,
      usedMemBytes: 6_000_000_000,
      memUsedPercent: 75,
      cpuModel: 'CPU',
      cpuCount: 8,
      cpuLoadPercent: 12.5,
      note: 'ok',
    })
    expect(parsed.cpuCount).toBe(8)
    expect(parsed.cpuLoadPercent).toBe(12.5)
  })

  it('aceita cpuLoadPercent null', () => {
    const parsed = SystemSnapshotSchema.parse({
      platform: 'linux',
      release: '6.1',
      arch: 'x64',
      hostname: 'dev',
      uptimeSec: 10,
      totalMemBytes: 1000,
      freeMemBytes: 500,
      usedMemBytes: 500,
      memUsedPercent: 50,
      cpuModel: 'CPU',
      cpuCount: 2,
      cpuLoadPercent: null,
      note: 'n',
    })
    expect(parsed.cpuLoadPercent).toBeNull()
  })
})
