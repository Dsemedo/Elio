import { z } from 'zod'
import { IpcChannels } from './channels'
import type {
  AppInfo,
  BudgetSnapshot,
  ChatMessage,
  ChatRenameInput,
  ChatRole,
  ChatSendInput,
  ChatSendResult,
  ChatStatus,
  ChatUpdatedEvent,
  Conversation,
  ConversationSummary,
  DeleteAllDataResult,
  Memory,
  MemoryCreateInput,
  MemoryUpdateInput,
  ProviderKind,
  RouteTier,
  SettingsOpenRouterKeyInput,
  SettingsPublic,
  SettingsUpdateInput,
  UserDataExportPayload,
  ShellState,
  SystemSnapshot,
  AppLocation,
  LocationSaveOsInput,
  SttPreference,
  TtsPreference,
  TtsSetSettingsInput,
  TtsSettings,
  TtsSynthesizeInput,
  TtsSynthesizeResult,
  MicAccessSnapshot,
  VoiceProgress,
  VoiceStatus,
  VoiceTranscribeInput,
  VoiceTranscribeResult,
} from './types'

export { IpcChannels }
export type { IpcChannel } from './channels'
export type {
  AppInfo,
  ChatMessage,
  ChatRenameInput,
  ChatRole,
  ChatSendInput,
  ChatSendResult,
  ChatStatus,
  ChatUpdatedEvent,
  Conversation,
  ConversationSummary,
  DeleteAllDataResult,
  Memory,
  MemoryCreateInput,
  MemoryUpdateInput,
  ProviderKind,
  RouteTier,
  BudgetSnapshot,
  SettingsOpenRouterKeyInput,
  SettingsPublic,
  SettingsUpdateInput,
  UserDataExportPayload,
  ShellState,
  SystemSnapshot,
  AppLocation,
  LocationSaveOsInput,
  SttPreference,
  TtsPreference,
  TtsSetSettingsInput,
  TtsSettings,
  TtsSynthesizeInput,
  TtsSynthesizeResult,
  MicAccessSnapshot,
  VoiceProgress,
  VoiceStatus,
  VoiceTranscribeInput,
  VoiceTranscribeResult,
}

export const ChatRoleSchema = z.enum(['user', 'assistant', 'system'])

export const ChatMessageSchema = z.object({
  id: z.string().min(1),
  role: ChatRoleSchema,
  content: z.string(),
  model: z.string().optional(),
  createdAt: z.string().datetime(),
})

export const ConversationSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  updatedAt: z.string().datetime(),
  messageCount: z.number().int().nonnegative(),
})

export const ConversationSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  messages: z.array(ChatMessageSchema),
})

export const ProviderKindSchema = z.enum(['ollama', 'openrouter', 'none'])

export const RouteTierSchema = z.enum(['byok', 'free', 'local', 'tool'])

export const BudgetSnapshotSchema = z.object({
  byokUsed: z.number().int().nonnegative(),
  freeUsed: z.number().int().nonnegative(),
  localUsed: z.number().int().nonnegative(),
  byokLimit: z.number().int().nonnegative().nullable(),
  freeLimit: z.number().int().nonnegative().nullable(),
  localLimit: z.number().int().nonnegative().nullable(),
  enforce: z.boolean(),
})

export const ChatStatusSchema = z.object({
  ollamaAvailable: z.boolean(),
  openRouterConfigured: z.boolean(),
  preferredProvider: ProviderKindSchema,
  preferredTier: z.union([RouteTierSchema, z.literal('none')]),
  cascadeOrder: z.tuple([
    z.literal('byok'),
    z.literal('free'),
    z.literal('local'),
  ]),
  hint: z.string(),
  budget: BudgetSnapshotSchema,
  spotifyClientConfigured: z.boolean(),
  spotifyConnected: z.boolean(),
})

export const ChatSendInputSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().trim().min(1).max(8000),
})

export const ChatSendResultSchema = z.object({
  conversation: ConversationSchema,
  reply: ChatMessageSchema,
  provider: ProviderKindSchema,
  model: z.string(),
  routeTier: RouteTierSchema,
  servedByLabel: z.string().min(1),
})

export const ChatCancelInputSchema = z.object({
  conversationId: z.string().min(1),
})

export const ConversationIdSchema = z.object({
  conversationId: z.string().min(1),
})

export const ChatRenameInputSchema = z.object({
  conversationId: z.string().min(1),
  title: z.string().trim().min(1).max(80),
})

export const ChatUpdatedEventSchema = z.object({
  reason: z.enum(['created', 'updated', 'deleted']),
  conversationId: z.string().min(1),
  conversation: ConversationSchema.optional(),
})

export const SettingsPublicSchema = z.object({
  ollamaHost: z.string().min(1),
  ollamaModel: z.string().min(1),
  openRouterModel: z.string().min(1),
  weatherCity: z.string(),
  openRouterKeyConfigured: z.boolean(),
  openRouterKeySource: z.enum(['env', 'store', 'none']),
  encryptionAvailable: z.boolean(),
})

export const SettingsUpdateInputSchema = z.object({
  ollamaHost: z.string().max(200).optional(),
  ollamaModel: z.string().max(80).optional(),
  openRouterModel: z.string().max(120).optional(),
  weatherCity: z.string().max(80).optional(),
})

export const SettingsOpenRouterKeyInputSchema = z.object({
  apiKey: z.string().trim().min(8).max(500),
})

export const SettingsProbeOllamaResultSchema = z.object({
  ok: z.boolean(),
  host: z.string(),
  message: z.string(),
})

export const VoiceStatusSchema = z.object({
  ready: z.boolean(),
  binaryReady: z.boolean(),
  modelReady: z.boolean(),
  modelId: z.enum(['tiny', 'base', 'small']),
  whisperVersion: z.string().min(1),
  supported: z.boolean(),
  hint: z.string(),
  sttPreference: z.enum(['auto', 'windows-speech', 'whisper']),
  platform: z.string().min(1),
})

export const AppLocationSchema = z.object({
  name: z.string().min(1).max(120),
  source: z.enum(['os', 'ip', 'manual']),
  updatedAt: z.string().datetime(),
  permissionDenied: z.boolean().optional(),
})

export const LocationSaveOsInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

export const VoiceProgressSchema = z.object({
  phase: z.enum(['binary', 'model', 'extract', 'idle']),
  percent: z.number().min(0).max(100),
  message: z.string(),
})

/** WAV PCM em base64 (sem data-URL obrigatória). Limite ~8 MB decodificados no main. */
export const VoiceTranscribeInputSchema = z.object({
  audioBase64: z.string().min(1).max(12_000_000),
})

export const VoiceTranscribeResultSchema = z.object({
  text: z.string(),
})

export const TtsPreferenceSchema = z.enum(['auto', 'system', 'edge'])

export const TtsSettingsSchema = z.object({
  enabled: z.boolean(),
  provider: TtsPreferenceSchema,
  edgeVoice: z.string().min(1).max(80),
  envOverride: z.boolean(),
  hint: z.string(),
})

export const TtsSetSettingsInputSchema = z
  .object({
    enabled: z.boolean().optional(),
    provider: TtsPreferenceSchema.optional(),
    edgeVoice: z.string().trim().min(1).max(80).optional(),
  })
  .refine(
    (v) =>
      v.enabled !== undefined || v.provider !== undefined || v.edgeVoice !== undefined,
    { message: 'Informe ao menos um campo' },
  )

export const TtsSynthesizeInputSchema = z.object({
  text: z.string().trim().min(1).max(8000),
  voice: z.string().trim().min(1).max(80).optional(),
})

export const TtsSynthesizeResultSchema = z.object({
  audioBase64: z.string().min(1),
  mimeType: z.literal('audio/mpeg'),
  voice: z.string().min(1),
  chars: z.number().int().nonnegative(),
})

export const ShellStateSchema = z.object({
  panelOpen: z.boolean(),
  barVisible: z.boolean(),
  /**
   * Legacy: antes escondia barra+painel no blur.
   * Com DS v1.1 / UX 0.5.1 a barra não some por foco; o campo
   * permanece p/ compat e fica false no default.
   */
  hiddenByFocus: z.boolean(),
})

export const ShellBarOverlaySchema = z.object({
  open: z.boolean(),
})

export const SystemSnapshotSchema = z.object({
  platform: z.enum([
    'aix',
    'android',
    'darwin',
    'freebsd',
    'haiku',
    'linux',
    'openbsd',
    'sunos',
    'win32',
    'cygwin',
    'netbsd',
  ]),
  release: z.string(),
  arch: z.string(),
  hostname: z.string(),
  uptimeSec: z.number().nonnegative(),
  totalMemBytes: z.number().nonnegative(),
  freeMemBytes: z.number().nonnegative(),
  usedMemBytes: z.number().nonnegative(),
  memUsedPercent: z.number().min(0).max(100),
  cpuModel: z.string(),
  cpuCount: z.number().int().positive(),
  cpuLoadPercent: z.number().min(0).max(100).nullable(),
  note: z.string(),
})


export const MemorySchema = z.object({
  id: z.string().min(1),
  content: z.string().trim().min(1).max(500),
  tags: z.array(z.string().trim().min(1).max(32)).max(8),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const MemoryCreateInputSchema = z.object({
  content: z.string().trim().min(1).max(500),
  tags: z.array(z.string().trim().min(1).max(32)).max(8).optional(),
})

export const MemoryUpdateInputSchema = z.object({
  id: z.string().min(1),
  content: z.string().trim().min(1).max(500).optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(8).optional(),
})

export const MemoryIdSchema = z.object({
  id: z.string().min(1),
})

export const UserDataExportPayloadSchema = z.object({
  json: z.string().min(2),
  conversationCount: z.number().int().nonnegative(),
  memoryCount: z.number().int().nonnegative(),
})

export const DeleteAllDataResultSchema = z.object({
  ok: z.literal(true),
  removed: z.object({
    conversations: z.boolean(),
    memories: z.number().int().nonnegative(),
    location: z.boolean(),
    openRouterKey: z.boolean(),
    spotifyTokens: z.boolean(),
  }),
})
