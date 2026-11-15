import {
  isFreeOpenRouterModel,
  servedByLabel,
  type RouteTier,
} from '../../shared/aiRoute'
import type { ChatStatus, ProviderKind } from '../../shared/ipc'
import {
  getBudgetSnapshot,
  isBudgetExhausted,
  recordUsage,
  type BudgetBucket,
} from './providers/budget'
import { ollamaProvider } from './providers/ollama'
import {
  isOpenRouterConfigured,
  openRouterFreeModel,
  openRouterProvider,
  preferredOpenRouterModel,
} from './providers/openrouter'
import type { ChatCompletionRequest, ChatCompletionResult } from './providers/types'
import { getSpotifyConnectionStatus } from './spotify'

function safeErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return 'erro desconhecido'
  // Nunca ecoar possíveis secrets — só mensagem curta já sanitizada pelos providers.
  return err.message.slice(0, 160)
}

function withMeta(
  result: ChatCompletionResult,
  tier: Exclude<RouteTier, 'tool'>,
  bucket: BudgetBucket,
): ChatCompletionResult {
  recordUsage(bucket)
  const provider = result.provider === 'ollama' ? 'ollama' : 'openrouter'
  const label = servedByLabel(provider, tier, result.model)
  return {
    ...result,
    routeTier: tier,
    servedByLabel: label,
  }
}

/**
 * Cascata PJ-34: BYOK (OpenRouter modelo pago) → cota grátis (OpenRouter :free) → Ollama.
 * Chave via Configurações (safeStorage) ou OPENROUTER_API_KEY. Sem OAuth ChatGPT/Gemini — ADR 0011.
 */
export async function routeCompletion(
  request: ChatCompletionRequest,
): Promise<ChatCompletionResult> {
  const failures: string[] = []
  const openRouterReady = await openRouterProvider.isAvailable()
  const ollamaReady = await ollamaProvider.isAvailable()
  const preferred = preferredOpenRouterModel()

  // 1) BYOK — chave OpenRouter + modelo que não é :free
  if (openRouterReady && !isFreeOpenRouterModel(preferred)) {
    if (isBudgetExhausted('byok')) {
      failures.push('BYOK: cota local esgotada (stub)')
    } else {
      try {
        const result = await openRouterProvider.complete({
          ...request,
          model: preferred,
        })
        return withMeta(result, 'byok', 'byok')
      } catch (err) {
        failures.push(`BYOK: ${safeErrorMessage(err)}`)
      }
    }
  }

  // 2) Cota grátis — OpenRouter com modelo :free
  if (openRouterReady) {
    if (isBudgetExhausted('free')) {
      failures.push('cota grátis: limite local esgotado (stub)')
    } else {
      try {
        const result = await openRouterProvider.complete({
          ...request,
          model: openRouterFreeModel(),
        })
        return withMeta(result, 'free', 'free')
      } catch (err) {
        failures.push(`cota grátis: ${safeErrorMessage(err)}`)
      }
    }
  }

  // 3) Local — Ollama
  if (ollamaReady) {
    if (isBudgetExhausted('local')) {
      failures.push('Ollama: cota local esgotada (stub)')
    } else {
      try {
        const result = await ollamaProvider.complete(request)
        return withMeta(result, 'local', 'local')
      } catch (err) {
        failures.push(`Ollama: ${safeErrorMessage(err)}`)
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Nenhum provedor respondeu. Cascata BYOK → cota grátis → Ollama. Detalhes: ${failures.join(' · ')}`,
    )
  }

  throw new Error(
    'Nenhum provedor disponível. Configure OpenRouter em Configurações ou abra o Ollama (veja o README).',
  )
}

export async function getChatStatus(): Promise<ChatStatus> {
  const ollamaAvailable = await ollamaProvider.isAvailable()
  const openRouterConfigured = await isOpenRouterConfigured()
  const spotify = await getSpotifyConnectionStatus()
  const preferredModel = preferredOpenRouterModel()
  const budget = getBudgetSnapshot()

  let preferredProvider: ProviderKind = 'none'
  let preferredTier: RouteTier | 'none' = 'none'
  let hint: string

  if (openRouterConfigured && !isFreeOpenRouterModel(preferredModel)) {
    preferredProvider = 'openrouter'
    preferredTier = 'byok'
    hint =
      'Cascata: BYOK (OpenRouter) → cota grátis → Ollama. Chave + modelo pago detectados.'
  } else if (openRouterConfigured) {
    preferredProvider = 'openrouter'
    preferredTier = 'free'
    hint = ollamaAvailable
      ? 'Cascata: cota grátis (OpenRouter) → Ollama local. Chave free detectada.'
      : 'Usando OpenRouter (cota grátis). Ollama offline — opcional para fallback local.'
  } else if (ollamaAvailable) {
    preferredProvider = 'ollama'
    preferredTier = 'local'
    hint =
      'Sem chave OpenRouter. Usando Ollama local. Para BYOK/cota, configure em Configurações → Integrações.'
  } else {
    hint =
      'Nenhum provedor pronto. Configure OpenRouter em Configurações → Integrações ou instale o Ollama.'
  }

  return {
    ollamaAvailable,
    openRouterConfigured,
    preferredProvider,
    preferredTier,
    cascadeOrder: ['byok', 'free', 'local'],
    hint,
    budget,
    spotifyClientConfigured: spotify.clientConfigured,
    spotifyConnected: spotify.connected,
  }
}
