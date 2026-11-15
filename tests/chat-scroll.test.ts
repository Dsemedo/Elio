import { describe, expect, it } from 'vitest'
import {
  distanceFromBottom,
  isNearBottom,
  shouldAutoScrollToBottom,
  NEAR_BOTTOM_PX,
} from '../src/shared/chatScroll'

describe('chatScroll', () => {
  it('calcula distância do fundo', () => {
    expect(distanceFromBottom(0, 400, 1000)).toBe(600)
    expect(distanceFromBottom(600, 400, 1000)).toBe(0)
  })

  it('detecta near-bottom com threshold', () => {
    expect(isNearBottom(900, 100, 1000, NEAR_BOTTOM_PX)).toBe(true)
    expect(isNearBottom(0, 100, 1000, NEAR_BOTTOM_PX)).toBe(false)
  })

  it('só força auto-scroll quando sticky ou near-bottom', () => {
    expect(shouldAutoScrollToBottom({ wasNearBottom: true, forceStick: false })).toBe(
      true,
    )
    expect(shouldAutoScrollToBottom({ wasNearBottom: false, forceStick: true })).toBe(
      true,
    )
    expect(shouldAutoScrollToBottom({ wasNearBottom: false, forceStick: false })).toBe(
      false,
    )
  })
})
