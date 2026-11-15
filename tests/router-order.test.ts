import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../src/main/services/providers/ollama', () => ({
  ollamaProvider: {
    kind: 'ollama',
    isAvailable: vi.fn(),
    complete: vi.fn(),
  },
}))

vi.mock('../src/main/services/providers/openrouter', () => ({
  isOpenRouterConfigured: vi.fn(),
  preferredOpenRouterModel: vi.fn(),
  openRouterFreeModel: vi.fn(),
  openRouterProvider: {
    kind: 'openrouter',
    isAvailable: vi.fn(),
    complete: vi.fn(),
  },
}))

vi.mock('../src/main/services/spotify', () => ({
  getSpotifyConnectionStatus: vi.fn(async () => ({
    clientConfigured: false,
    connected: false,
    encryptionAvailable: true,
  })),
}))

import { ollamaProvider } from '../src/main/services/providers/ollama'
import {
  isOpenRouterConfigured,
  openRouterFreeModel,
  openRouterProvider,
  preferredOpenRouterModel,
} from '../src/main/services/providers/openrouter'
import {
  resetBudgetForTests,
} from '../src/main/services/providers/budget'
import { getChatStatus, routeCompletion } from '../src/main/services/router'

describe('cascata BYOK → free → Ollama (PJ-34)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetBudgetForTests()
    delete process.env['ELIO_AI_BUDGET_ENFORCE']
    delete process.env['ELIO_AI_BUDGET_FREE_DAILY']
    vi.mocked(preferredOpenRouterModel).mockReturnValue(
      'meta-llama/llama-3.2-3b-instruct:free',
    )
    vi.mocked(openRouterFreeModel).mockReturnValue(
      'meta-llama/llama-3.2-3b-instruct:free',
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prioriza OpenRouter BYOK sobre Ollama quando modelo não é :free', async () => {
    vi.mocked(preferredOpenRouterModel).mockReturnValue('anthropic/claude-3.5-sonnet')
    vi.mocked(openRouterProvider.isAvailable).mockResolvedValue(true)
    vi.mocked(ollamaProvider.isAvailable).mockResolvedValue(true)
    vi.mocked(openRouterProvider.complete).mockResolvedValue({
      content: 'oi byok',
      model: 'anthropic/claude-3.5-sonnet',
      provider: 'openrouter',
    })

    const result = await routeCompletion({
      messages: [{ role: 'user', content: 'oi' }],
    })

    expect(result.provider).toBe('openrouter')
    expect(result.routeTier).toBe('byok')
    expect(result.servedByLabel).toMatch(/BYOK/)
    expect(ollamaProvider.complete).not.toHaveBeenCalled()
  })

  it('usa cota grátis OpenRouter antes do Ollama', async () => {
    vi.mocked(openRouterProvider.isAvailable).mockResolvedValue(true)
    vi.mocked(ollamaProvider.isAvailable).mockResolvedValue(true)
    vi.mocked(openRouterProvider.complete).mockResolvedValue({
      content: 'oi free',
      model: 'meta-llama/llama-3.2-3b-instruct:free',
      provider: 'openrouter',
    })

    const result = await routeCompletion({
      messages: [{ role: 'user', content: 'oi' }],
    })

    expect(result.provider).toBe('openrouter')
    expect(result.routeTier).toBe('free')
    expect(result.servedByLabel).toMatch(/cota grátis/)
    expect(ollamaProvider.complete).not.toHaveBeenCalled()
  })

  it('cai para Ollama se OpenRouter falhar', async () => {
    vi.mocked(openRouterProvider.isAvailable).mockResolvedValue(true)
    vi.mocked(ollamaProvider.isAvailable).mockResolvedValue(true)
    vi.mocked(openRouterProvider.complete).mockRejectedValue(
      new Error('OpenRouter respondeu 429'),
    )
    vi.mocked(ollamaProvider.complete).mockResolvedValue({
      content: 'oi local',
      model: 'llama3.2',
      provider: 'ollama',
    })

    const result = await routeCompletion({
      messages: [{ role: 'user', content: 'oi' }],
    })

    expect(result.provider).toBe('ollama')
    expect(result.routeTier).toBe('local')
    expect(result.servedByLabel).toMatch(/Ollama/)
  })

  it('cai de BYOK para free e depois Ollama', async () => {
    vi.mocked(preferredOpenRouterModel).mockReturnValue('openai/gpt-4o')
    vi.mocked(openRouterFreeModel).mockReturnValue(
      'meta-llama/llama-3.2-3b-instruct:free',
    )
    vi.mocked(openRouterProvider.isAvailable).mockResolvedValue(true)
    vi.mocked(ollamaProvider.isAvailable).mockResolvedValue(true)
    vi.mocked(openRouterProvider.complete)
      .mockRejectedValueOnce(new Error('OpenRouter respondeu 402'))
      .mockRejectedValueOnce(new Error('OpenRouter respondeu 429'))
    vi.mocked(ollamaProvider.complete).mockResolvedValue({
      content: 'local ok',
      model: 'llama3.2',
      provider: 'ollama',
    })

    const result = await routeCompletion({
      messages: [{ role: 'user', content: 'oi' }],
    })

    expect(openRouterProvider.complete).toHaveBeenCalledTimes(2)
    expect(result.routeTier).toBe('local')
  })

  it('usa só Ollama sem chave OpenRouter', async () => {
    vi.mocked(openRouterProvider.isAvailable).mockResolvedValue(false)
    vi.mocked(ollamaProvider.isAvailable).mockResolvedValue(true)
    vi.mocked(ollamaProvider.complete).mockResolvedValue({
      content: 'só local',
      model: 'llama3.2',
      provider: 'ollama',
    })

    const result = await routeCompletion({
      messages: [{ role: 'user', content: 'oi' }],
    })

    expect(result.provider).toBe('ollama')
    expect(openRouterProvider.complete).not.toHaveBeenCalled()
  })

  it('falha com mensagem clara sem provedores', async () => {
    vi.mocked(openRouterProvider.isAvailable).mockResolvedValue(false)
    vi.mocked(ollamaProvider.isAvailable).mockResolvedValue(false)

    await expect(
      routeCompletion({ messages: [{ role: 'user', content: 'oi' }] }),
    ).rejects.toThrow(/Nenhum provedor/)
  })

  it('status aponta openrouter free quando chave free + ollama', async () => {
    vi.mocked(ollamaProvider.isAvailable).mockResolvedValue(true)
    vi.mocked(isOpenRouterConfigured).mockResolvedValue(true)

    const status = await getChatStatus()
    expect(status.preferredProvider).toBe('openrouter')
    expect(status.preferredTier).toBe('free')
    expect(status.cascadeOrder).toEqual(['byok', 'free', 'local'])
    expect(status.budget.enforce).toBe(false)
  })

  it('status aponta none quando nada está pronto', async () => {
    vi.mocked(ollamaProvider.isAvailable).mockResolvedValue(false)
    vi.mocked(isOpenRouterConfigured).mockResolvedValue(false)

    const status = await getChatStatus()
    expect(status.preferredProvider).toBe('none')
    expect(status.preferredTier).toBe('none')
    expect(status.hint.toLowerCase()).toMatch(/openrouter|ollama/)
  })

  it('respeita soft-block de budget quando enforce=true', async () => {
    process.env['ELIO_AI_BUDGET_ENFORCE'] = 'true'
    process.env['ELIO_AI_BUDGET_FREE_DAILY'] = '0'
    vi.mocked(openRouterProvider.isAvailable).mockResolvedValue(true)
    vi.mocked(ollamaProvider.isAvailable).mockResolvedValue(true)
    vi.mocked(ollamaProvider.complete).mockResolvedValue({
      content: 'local após budget',
      model: 'llama3.2',
      provider: 'ollama',
    })

    const result = await routeCompletion({
      messages: [{ role: 'user', content: 'oi' }],
    })

    expect(openRouterProvider.complete).not.toHaveBeenCalled()
    expect(result.routeTier).toBe('local')
  })
})
