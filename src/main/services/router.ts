import type { ChatStatus, ProviderKind } from '../../shared/ipc'
import { ollamaProvider } from './providers/ollama'
import { isOpenRouterConfigured, openRouterProvider } from './providers/openrouter'
import type { ChatCompletionRequest, ChatCompletionResult } from './providers/types'
import { getSpotifyConnectionStatus } from './spotify'

export async function getChatStatus(): Promise<ChatStatus> {
  const ollamaAvailable = await ollamaProvider.isAvailable()
  const openRouterConfigured = await isOpenRouterConfigured()
  const spotify = await getSpotifyConnectionStatus()

  let preferredProvider: ProviderKind = 'none'
  let hint: string

  if (ollamaAvailable) {
    preferredProvider = 'ollama'
    hint = 'Ollama local detectado — as respostas vão priorizar o modelo da sua máquina.'
  } else if (openRouterConfigured) {
    preferredProvider = 'openrouter'
    hint = 'Ollama offline. Usando OpenRouter (chave salva neste PC ou no ambiente).'
  } else {
    hint =
      'Nenhum provedor pronto. Instale o Ollama ou configure a chave OpenRouter em Configurações → Integrações.'
  }

  return {
    ollamaAvailable,
    openRouterConfigured,
    preferredProvider,
    hint,
    spotifyClientConfigured: spotify.clientConfigured,
    spotifyConnected: spotify.connected,
  }
}

export async function routeCompletion(
  request: ChatCompletionRequest,
): Promise<ChatCompletionResult> {
  if (await ollamaProvider.isAvailable()) {
    return ollamaProvider.complete(request)
  }

  if (await openRouterProvider.isAvailable()) {
    return openRouterProvider.complete(request)
  }

  throw new Error(
    'Nenhum provedor disponível. Abra o Ollama ou configure OpenRouter em Configurações.',
  )
}
