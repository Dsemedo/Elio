import { describe, expect, it } from 'vitest'
import {
  MIC_RELEASE_SETTLE_MS,
  SPEECH_RESTART_DELAY_MS,
  canFinishSpeechStopWithoutEngine,
  shouldScheduleSpeechRestart,
} from '../src/shared/speechRestart'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('speechRestart helpers', () => {
  it('delay de restart > 0 (nunca start síncrono no onend)', () => {
    expect(SPEECH_RESTART_DELAY_MS).toBeGreaterThan(0)
    expect(SPEECH_RESTART_DELAY_MS).toBeLessThanOrEqual(500)
  })

  it('settle após liberar mic > 0', () => {
    expect(MIC_RELEASE_SETTLE_MS).toBeGreaterThan(0)
    expect(MIC_RELEASE_SETTLE_MS).toBeLessThanOrEqual(500)
  })

  it('agenda restart só com PTT ativo', () => {
    expect(shouldScheduleSpeechRestart({ settled: false, stopping: false })).toBe(true)
    expect(shouldScheduleSpeechRestart({ settled: true, stopping: false })).toBe(false)
    expect(shouldScheduleSpeechRestart({ settled: false, stopping: true })).toBe(false)
  })

  it('stop sem engine ativo pode finalizar na hora', () => {
    expect(canFinishSpeechStopWithoutEngine({ settled: false, listening: false })).toBe(true)
    expect(canFinishSpeechStopWithoutEngine({ settled: false, listening: true })).toBe(false)
    expect(canFinishSpeechStopWithoutEngine({ settled: true, listening: false })).toBe(false)
  })
})

describe('windowsSpeech.ts usa restart adiado', () => {
  const src = readFileSync(
    join(__dirname, '../src/renderer/src/lib/windowsSpeech.ts'),
    'utf8',
  )

  it('reinicia via setTimeout + SPEECH_RESTART_DELAY_MS (não start síncrono só no onend)', () => {
    expect(src).toContain('SPEECH_RESTART_DELAY_MS')
    expect(src).toContain('setTimeout')
    expect(src).toContain('shouldScheduleSpeechRestart')
    expect(src).toMatch(/onend[\s\S]*tryRestart/)
  })
})
