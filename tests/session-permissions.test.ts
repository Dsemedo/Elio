import { describe, expect, it } from 'vitest'
import { isAppPermissionAllowed } from '../src/main/sessionPermissions'

describe('isAppPermissionAllowed', () => {
  it('libera geolocation e media/mic (Speech + getUserMedia)', () => {
    expect(isAppPermissionAllowed('geolocation')).toBe(true)
    expect(isAppPermissionAllowed('media')).toBe(true)
    expect(isAppPermissionAllowed('microphone')).toBe(true)
    expect(isAppPermissionAllowed('speaker-selection')).toBe(true)
  })

  it('nega permissões não relacionadas ao app', () => {
    expect(isAppPermissionAllowed('notifications')).toBe(false)
    expect(isAppPermissionAllowed('openExternal')).toBe(false)
    expect(isAppPermissionAllowed('clipboard-read')).toBe(false)
  })
})
