import { describe, expect, it } from 'vitest'
import {
  UPDATE_CHECK_INTERVAL_MS,
  VERIFY_UPDATE_SIGNATURE,
} from '../src/main/services/updater/constants'
import {
  getUpdateCheckIntervalMs,
  shouldEnableAutoUpdater,
  updateDownloadedNotification,
} from '../src/main/services/updater/policy'

describe('updater policy (PJ-37)', () => {
  it('só liga em win32 empacotado', () => {
    expect(
      shouldEnableAutoUpdater({
        isPackaged: true,
        platform: 'win32',
      }),
    ).toBe(true)
    expect(
      shouldEnableAutoUpdater({
        isPackaged: false,
        platform: 'win32',
      }),
    ).toBe(false)
    expect(
      shouldEnableAutoUpdater({
        isPackaged: true,
        platform: 'linux',
      }),
    ).toBe(false)
  })

  it('respeita ELIO_DISABLE_UPDATER', () => {
    expect(
      shouldEnableAutoUpdater({
        isPackaged: true,
        platform: 'win32',
        env: { ELIO_DISABLE_UPDATER: '1' },
      }),
    ).toBe(false)
    expect(
      shouldEnableAutoUpdater({
        isPackaged: true,
        platform: 'win32',
        env: { ELIO_DISABLE_UPDATER: 'true' },
      }),
    ).toBe(false)
  })

  it('intervalo de 4h e assinatura desligada no MVP unsigned', () => {
    expect(getUpdateCheckIntervalMs()).toBe(4 * 60 * 60 * 1000)
    expect(UPDATE_CHECK_INTERVAL_MS).toBe(getUpdateCheckIntervalMs())
    expect(VERIFY_UPDATE_SIGNATURE).toBe(false)
  })

  it('notificação discreta em PT-BR (não força reinício)', () => {
    const note = updateDownloadedNotification('0.12.0')
    expect(note.title).toContain('Elio')
    expect(note.body).toContain('0.12.0')
    expect(note.body.toLowerCase()).not.toContain('obrigatório')
  })
})
