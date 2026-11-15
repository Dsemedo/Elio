import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  VOICE_CONFIRM_MS,
  armVoiceConfirmSend,
} from '../src/shared/voiceConfirm'

describe('armVoiceConfirmSend', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('dispara após o delay', () => {
    vi.useFakeTimers()
    const onFire = vi.fn()
    const ctrl = armVoiceConfirmSend(onFire, VOICE_CONFIRM_MS)
    expect(ctrl.isArmed()).toBe(true)
    vi.advanceTimersByTime(VOICE_CONFIRM_MS - 1)
    expect(onFire).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onFire).toHaveBeenCalledTimes(1)
    expect(ctrl.isArmed()).toBe(false)
  })

  it('cancel impede o auto-envio', () => {
    vi.useFakeTimers()
    const onFire = vi.fn()
    const ctrl = armVoiceConfirmSend(onFire, VOICE_CONFIRM_MS)
    ctrl.cancel()
    vi.advanceTimersByTime(VOICE_CONFIRM_MS + 100)
    expect(onFire).not.toHaveBeenCalled()
    expect(ctrl.isArmed()).toBe(false)
  })
})
