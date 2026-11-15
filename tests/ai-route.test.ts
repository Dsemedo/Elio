import { describe, expect, it } from 'vitest'
import {
  OPENROUTER_DEFAULT_FREE_MODEL,
  isFreeOpenRouterModel,
  routeTierLabel,
  servedByLabel,
} from '../src/shared/aiRoute'
import {
  getBudgetSnapshot,
  isBudgetExhausted,
  recordUsage,
  resetBudgetForTests,
} from '../src/main/services/providers/budget'

describe('aiRoute helpers', () => {
  it('detecta modelos :free do OpenRouter', () => {
    expect(isFreeOpenRouterModel(OPENROUTER_DEFAULT_FREE_MODEL)).toBe(true)
    expect(isFreeOpenRouterModel('openai/gpt-4o')).toBe(false)
  })

  it('monta rótulos claros para a UI', () => {
    expect(routeTierLabel('byok')).toBe('BYOK')
    expect(servedByLabel('openrouter', 'free', 'm')).toMatch(/cota grátis/)
    expect(servedByLabel('ollama', 'local', 'llama3.2')).toMatch(/Ollama/)
  })
})

describe('budget stub', () => {
  it('não bloqueia sem enforce', () => {
    resetBudgetForTests()
    delete process.env['ELIO_AI_BUDGET_ENFORCE']
    process.env['ELIO_AI_BUDGET_FREE_DAILY'] = '1'
    recordUsage('free')
    expect(isBudgetExhausted('free')).toBe(false)
    const snap = getBudgetSnapshot()
    expect(snap.freeUsed).toBe(1)
    expect(snap.enforce).toBe(false)
  })

  it('bloqueia com enforce e limite', () => {
    resetBudgetForTests()
    process.env['ELIO_AI_BUDGET_ENFORCE'] = 'true'
    process.env['ELIO_AI_BUDGET_FREE_DAILY'] = '1'
    expect(isBudgetExhausted('free')).toBe(false)
    recordUsage('free')
    expect(isBudgetExhausted('free')).toBe(true)
    delete process.env['ELIO_AI_BUDGET_ENFORCE']
    delete process.env['ELIO_AI_BUDGET_FREE_DAILY']
  })
})
