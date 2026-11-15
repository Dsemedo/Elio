import { describe, expect, it } from 'vitest'
import {
  isAppPermissionAllowed,
  isMediaAudioAllowed,
} from '../src/main/sessionPermissions'

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

describe('isMediaAudioAllowed', () => {
  it('libera media sem mediaTypes (Speech / getUserMedia audio-only)', () => {
    expect(isMediaAudioAllowed('media')).toBe(true)
    expect(isMediaAudioAllowed('media', {})).toBe(true)
    expect(isMediaAudioAllowed('microphone')).toBe(true)
    expect(isMediaAudioAllowed('geolocation')).toBe(true)
  })

  it('libera media com audio nos mediaTypes', () => {
    expect(isMediaAudioAllowed('media', { mediaTypes: ['audio'] })).toBe(true)
    expect(isMediaAudioAllowed('media', { mediaTypes: ['audio', 'video'] })).toBe(
      true,
    )
    expect(isMediaAudioAllowed('media', { mediaType: 'audio' })).toBe(true)
  })

  it('nega video-only', () => {
    expect(isMediaAudioAllowed('media', { mediaTypes: ['video'] })).toBe(false)
    expect(isMediaAudioAllowed('media', { mediaType: 'video' })).toBe(false)
  })

  it('nega permissões fora da allowlist', () => {
    expect(isMediaAudioAllowed('notifications')).toBe(false)
    expect(isMediaAudioAllowed('mediaKeySystem')).toBe(false)
  })
})
