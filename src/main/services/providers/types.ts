import type { ChatMessage, ProviderKind } from '../../../shared/ipc'

export type ChatCompletionRequest = {
  messages: Array<Pick<ChatMessage, 'role' | 'content'>>
  signal?: AbortSignal
}

export type ChatCompletionResult = {
  content: string
  model: string
  provider: ProviderKind
}

export type AiProvider = {
  kind: Exclude<ProviderKind, 'none'>
  isAvailable: () => Promise<boolean>
  complete: (request: ChatCompletionRequest) => Promise<ChatCompletionResult>
}
