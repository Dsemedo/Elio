import { describe, expect, it } from 'vitest'
import { IpcChannels } from '../src/shared/ipc'

describe('Sprint 0 smoke', () => {
  it('expõe canal IPC fixo de app info', () => {
    expect(IpcChannels.APP_GET_INFO).toBe('app:getInfo')
  })

  it('não permite inventar canais fora do enum', () => {
    const channels = Object.values(IpcChannels)
    expect(channels).toHaveLength(1)
    expect(channels.every((c) => typeof c === 'string' && c.includes(':'))).toBe(true)
  })
})
