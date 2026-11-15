import type { ChatStatus, ProviderKind } from '../../shared/ipc'
import { ollamaProvider } from './providers/ollama'
import { isOpenRouterConfigured, openRouterProvider } from './providers/openrouter'
import type { ChatCompletionRequest, ChatCompletionResult } from './providers/types'

export async function getChatStatus(): Promise<ChatStatus> {
  const ollamaAvailable = await ollamaProvider.isAvailable()
  const openRouterConfigured = isOpenRouterConfigured()

  let preferredProvider: ProviderKind = 'none'
  let hint: string

  if (ollamaAvailable) {
    preferredProvider = 'ollama'
    hint = 'Ollama local detectado — as respostas vão priorizar o modelo da sua máquina.'
  } else if (openRouterConfigured) {
    preferredProvider = 'openrouter'
    hint = 'Ollama offline. Usando OpenRouter (chave em OPENROUTER_API_KEY).'
  } else {
    hint =
      'Nenhum provedor pronto. Instale o Ollama (https://ollama.com) ou defina OPENROUTER_API_KEY e reinicie o Elio.'
  }

  return {
    ollamaAvailable,
    openRouterConfigured,
    preferredProvider,
    hint,
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
    'Nenhum provedor disponível. Abra o Ollama ou configure OPENROUTER_API_KEY (veja o README).',
  )
}
