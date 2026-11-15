import { z } from 'zod'
import { IpcChannels } from './channels'
import type {
  AppInfo,
  ChatMessage,
  ChatRole,
  ChatSendInput,
  ChatSendResult,
  ChatStatus,
  ChatUpdatedEvent,
  Conversation,
  ConversationSummary,
  ProviderKind,
  ShellState,
  SystemSnapshot,
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
  ChatRole,
  ChatSendInput,
  ChatSendResult,
  ChatStatus,
  ChatUpdatedEvent,
  Conversation,
  ConversationSummary,
  ProviderKind,
  ShellState,
  SystemSnapshot,
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

export const ChatStatusSchema = z.object({
  ollamaAvailable: z.boolean(),
  openRouterConfigured: z.boolean(),
  preferredProvider: ProviderKindSchema,
  hint: z.string(),
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
})

export const ChatCancelInputSchema = z.object({
  conversationId: z.string().min(1),
})

export const ConversationIdSchema = z.object({
  conversationId: z.string().min(1),
})

export const ChatUpdatedEventSchema = z.object({
  reason: z.enum(['created', 'updated', 'deleted']),
  conversationId: z.string().min(1),
  conversation: ConversationSchema.optional(),
})

export const VoiceStatusSchema = z.object({
  ready: z.boolean(),
  binaryReady: z.boolean(),
  modelReady: z.boolean(),
  modelId: z.literal('base'),
  whisperVersion: z.string().min(1),
  supported: z.boolean(),
  hint: z.string(),
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
