import type { RouteTier } from '../../../shared/aiRoute'
import type { ChatMessage, ProviderKind } from '../../../shared/ipc'

export type ChatCompletionRequest = {
  messages: Array<Pick<ChatMessage, 'role' | 'content'>>
  signal?: AbortSignal
  /** Sobrescreve o modelo do provedor (ex.: fallback free no OpenRouter). */
  model?: string
}

export type ChatCompletionResult = {
  content: string
  model: string
  provider: ProviderKind
  routeTier?: RouteTier
  servedByLabel?: string
}

export type AiProvider = {
  kind: Exclude<ProviderKind, 'none'>
  isAvailable: () => Promise<boolean>
  complete: (request: ChatCompletionRequest) => Promise<ChatCompletionResult>
}
