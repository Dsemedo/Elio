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
  /** Client ID Spotify (ELIO_SPOTIFY_CLIENT_ID) presente. */
  spotifyClientConfigured: boolean
  /** Tokens Spotify cifrados presentes em userData. */
  spotifyConnected: boolean
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

/** Evento de sync entre Floating Bar e Command Center. */
export type ChatUpdatedEvent = {
  reason: 'created' | 'updated' | 'deleted'
  conversationId: string
  conversation?: Conversation
}

export type VoiceModelId = 'tiny' | 'base' | 'small'

export type VoiceStatus = {
  ready: boolean
  binaryReady: boolean
  modelReady: boolean
  modelId: VoiceModelId
  whisperVersion: string
  supported: boolean
  hint: string
}

export type AppLocationSource = 'os' | 'ip' | 'manual'

export type AppLocation = {
  /** Nome da cidade (seguro para UI / enrich). */
  name: string
  source: AppLocationSource
  updatedAt: string
  /** true se o usuário negou a permissão OS. */
  permissionDenied?: boolean
}

export type LocationSaveOsInput = {
  latitude: number
  longitude: number
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

export type ShellState = {
  panelOpen: boolean
  barVisible: boolean
  hiddenByFocus: boolean
}

export type SystemSnapshot = {
  platform: NodeJS.Platform
  release: string
  arch: string
  hostname: string
  uptimeSec: number
  totalMemBytes: number
  freeMemBytes: number
  usedMemBytes: number
  memUsedPercent: number
  cpuModel: string
  cpuCount: number
  cpuLoadPercent: number | null
  note: string
}
