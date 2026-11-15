import type { BudgetSnapshot } from './aiBudget'
import type { RouteTier } from './aiRoute'
import type { SttPreference } from './sttPolicy'
import type { TtsPreference } from './ttsPolicy'

export type { BudgetSnapshot, RouteTier, SttPreference }
export type { TtsPreference }

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
  /** Camada preferida da cascata (BYOK → free → local). */
  preferredTier: RouteTier | 'none'
  /** Ordem documentada da cascata automática. */
  cascadeOrder: Array<'byok' | 'free' | 'local'>
  hint: string
  /** Contadores/limites stub (sem enforcement por padrão). */
  budget: BudgetSnapshot
  /** Client ID Spotify (ELIO_SPOTIFY_CLIENT_ID) presente. */
  spotifyClientConfigured: boolean
  /** Tokens Spotify cifrados presentes em userData. */
  spotifyConnected: boolean
}

export type Memory = {
  id: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export type MemoryCreateInput = {
  content: string
  tags?: string[]
}

export type MemoryUpdateInput = {
  id: string
  content?: string
  tags?: string[]
}

export type UserDataExportPayload = {
  json: string
  conversationCount: number
  memoryCount: number
}

export type DeleteAllDataResult = {
  ok: true
  removed: {
    conversations: boolean
    memories: number
    location: boolean
    openRouterKey: boolean
    spotifyTokens: boolean
  }
}

export type ChatRenameInput = {
  conversationId: string
  title: string
}

/** Preferências públicas (sem secrets). */
export type SettingsPublic = {
  ollamaHost: string
  ollamaModel: string
  openRouterModel: string
  weatherCity: string
  openRouterKeyConfigured: boolean
  openRouterKeySource: 'env' | 'store' | 'none'
  encryptionAvailable: boolean
}

export type SettingsUpdateInput = {
  ollamaHost?: string
  ollamaModel?: string
  openRouterModel?: string
  weatherCity?: string
}

export type SettingsOpenRouterKeyInput = {
  apiKey: string
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
  routeTier: RouteTier
  /** Rótulo amigável: quem serviu a resposta. */
  servedByLabel: string
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
  /**
   * Preferência de provedor STT (main lê ELIO_STT_PROVIDER).
   * O renderer combina com disponibilidade de SpeechRecognition.
   */
  sttPreference: SttPreference
  /** Plataforma do processo main — renderer usa para política win32-first. */
  platform: NodeJS.Platform
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

export type TtsSettings = {
  enabled: boolean
  provider: TtsPreference
  edgeVoice: string
  /** true se ELIO_TTS_* está sobrescrevendo o arquivo. */
  envOverride: boolean
  hint: string
}

export type TtsSetSettingsInput = {
  enabled?: boolean
  provider?: TtsPreference
  edgeVoice?: string
}

export type TtsSynthesizeInput = {
  text: string
  /** Opcional — senão usa voz das prefs. */
  voice?: string
}

export type TtsSynthesizeResult = {
  audioBase64: string
  mimeType: 'audio/mpeg'
  voice: string
  chars: number
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
