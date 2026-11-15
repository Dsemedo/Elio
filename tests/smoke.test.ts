import { describe, expect, it } from 'vitest'
import { IpcChannels } from '../src/shared/channels'

describe('Sprint 0 smoke', () => {
  it('expõe canal IPC fixo de app info', () => {
    expect(IpcChannels.APP_GET_INFO).toBe('app:getInfo')
  })

  it('mantém canais no formato namespace:action', () => {
    const channels = Object.values(IpcChannels)
    expect(channels.length).toBeGreaterThan(1)
    expect(channels.every((c) => typeof c === 'string' && c.includes(':'))).toBe(true)
  })
})
