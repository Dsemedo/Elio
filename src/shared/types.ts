export type AppInfo = {
  name: string
  version: string
  electron: string
  platform: NodeJS.Platform
}

export type ChatRole = 'user' | 'assistant' | 'system'

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  model?: string
  createdAt: string
}

export type ConversationSummary = {
  id: string
  title: string
  updatedAt: string
  messageCount: number
}

export type Conversation = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
}

export type ProviderKind = 'ollama' | 'openrouter' | 'none'

export type ChatStatus = {
  ollamaAvailable: boolean
  openRouterConfigured: boolean
  preferredProvider: ProviderKind
  hint: string
}

export type ChatSendInput = {
  conversationId: string
  content: string
}

export type ChatSendResult = {
  conversation: Conversation
  reply: ChatMessage
  provider: ProviderKind
  model: string
}

export type VoiceModelId = 'tiny'

export type VoiceStatus = {
  ready: boolean
  binaryReady: boolean
  modelReady: boolean
  modelId: VoiceModelId
  whisperVersion: string
  supported: boolean
  hint: string
}

export type VoiceProgress = {
  phase: 'binary' | 'model' | 'extract' | 'idle'
  percent: number
  message: string
}

export type VoiceTranscribeInput = {
  audioBase64: string
}

export type VoiceTranscribeResult = {
  text: string
}
