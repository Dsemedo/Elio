import { z } from 'zod'
import { IpcChannels } from './channels'
import type {
  AppInfo,
  ChatMessage,
  ChatRole,
  ChatSendInput,
  ChatSendResult,
  ChatStatus,
  Conversation,
  ConversationSummary,
  ProviderKind,
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
  Conversation,
  ConversationSummary,
  ProviderKind,
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
