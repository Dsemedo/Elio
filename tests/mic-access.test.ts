import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  systemPreferences: {
    getMediaAccessStatus: vi.fn(() => 'granted'),
  },
}))

import { systemPreferences } from 'electron'
import { readMicAccessStatus } from '../src/main/micAccess'

describe('readMicAccessStatus', () => {
  it('consulta microphone no Windows', () => {
    vi.mocked(systemPreferences.getMediaAccessStatus).mockReturnValueOnce('denied')
    const snap = readMicAccessStatus('win32')
    expect(snap).toEqual({ status: 'denied', platform: 'win32' })
    expect(systemPreferences.getMediaAccessStatus).toHaveBeenCalledWith('microphone')
  })

  it('fora de win32/darwin → unknown sem consultar', () => {
    vi.mocked(systemPreferences.getMediaAccessStatus).mockClear()
    const snap = readMicAccessStatus('linux')
    expect(snap).toEqual({ status: 'unknown', platform: 'linux' })
    expect(systemPreferences.getMediaAccessStatus).not.toHaveBeenCalled()
  })

  it('valor inesperado do Electron → unknown', () => {
    vi.mocked(systemPreferences.getMediaAccessStatus).mockReturnValueOnce(
      'weird' as 'granted',
    )
    expect(readMicAccessStatus('darwin').status).toBe('unknown')
  })
})
