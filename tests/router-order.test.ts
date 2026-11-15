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
  openRouterProvider,
} from '../src/main/services/providers/openrouter'
import { getChatStatus, routeCompletion } from '../src/main/services/router'

describe('smart router v1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prioriza Ollama quando disponível', async () => {
    vi.mocked(ollamaProvider.isAvailable).mockResolvedValue(true)
    vi.mocked(ollamaProvider.complete).mockResolvedValue({
      content: 'oi local',
      model: 'llama3.2',
      provider: 'ollama',
    })

    const result = await routeCompletion({
      messages: [{ role: 'user', content: 'oi' }],
    })

    expect(result.provider).toBe('ollama')
    expect(openRouterProvider.complete).not.toHaveBeenCalled()
  })

  it('cai para OpenRouter se Ollama offline e chave presente', async () => {
    vi.mocked(ollamaProvider.isAvailable).mockResolvedValue(false)
    vi.mocked(openRouterProvider.isAvailable).mockResolvedValue(true)
    vi.mocked(openRouterProvider.complete).mockResolvedValue({
      content: 'oi cloud',
      model: 'free',
      provider: 'openrouter',
    })

    const result = await routeCompletion({
      messages: [{ role: 'user', content: 'oi' }],
    })

    expect(result.provider).toBe('openrouter')
  })

  it('falha com mensagem clara sem provedores', async () => {
    vi.mocked(ollamaProvider.isAvailable).mockResolvedValue(false)
    vi.mocked(openRouterProvider.isAvailable).mockResolvedValue(false)

    await expect(
      routeCompletion({ messages: [{ role: 'user', content: 'oi' }] }),
    ).rejects.toThrow(/Nenhum provedor/)
  })

  it('status aponta none quando nada está pronto', async () => {
    vi.mocked(ollamaProvider.isAvailable).mockResolvedValue(false)
    vi.mocked(isOpenRouterConfigured).mockResolvedValue(false)

    const status = await getChatStatus()
    expect(status.preferredProvider).toBe('none')
    expect(status.hint.toLowerCase()).toContain('ollama')
  })
})
