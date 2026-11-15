import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import type { ChatMessage, Conversation, ConversationSummary } from '../../shared/ipc'

/**
 * Persistência local simples (JSON em userData).
 * SQLite + drizzle fica como follow-up — evita native rebuild no Windows agora.
 */
type StoreFile = {
  conversations: Conversation[]
}

function storePath(): string {
  return join(app.getPath('userData'), 'elio-chat.json')
}

function emptyStore(): StoreFile {
  return { conversations: [] }
}

function readStore(): StoreFile {
  const path = storePath()
  if (!existsSync(path)) return emptyStore()
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as StoreFile
    if (!Array.isArray(raw.conversations)) return emptyStore()
    return raw
  } catch {
    return emptyStore()
  }
}

function writeStore(data: StoreFile): void {
  const path = storePath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8')
}

function nowIso(): string {
  return new Date().toISOString()
}

export function listConversations(): ConversationSummary[] {
  return readStore()
    .conversations.map((c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
      messageCount: c.messages.length,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getConversation(id: string): Conversation | null {
  return readStore().conversations.find((c) => c.id === id) ?? null
}

export function createConversation(title = 'Nova conversa'): Conversation {
  const stamp = nowIso()
  const conversation: Conversation = {
    id: randomUUID(),
    title,
    createdAt: stamp,
    updatedAt: stamp,
    messages: [],
  }
  const data = readStore()
  data.conversations.unshift(conversation)
  writeStore(data)
  return conversation
}

export function deleteConversation(id: string): boolean {
  const data = readStore()
  const next = data.conversations.filter((c) => c.id !== id)
  if (next.length === data.conversations.length) return false
  writeStore({ conversations: next })
  return true
}

export function renameConversation(id: string, title: string): Conversation | null {
  const trimmed = title.replace(/\s+/g, ' ').trim()
  if (!trimmed) return null
  const safeTitle = trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed

  const data = readStore()
  const index = data.conversations.findIndex((c) => c.id === id)
  if (index < 0) return null
  const current = data.conversations[index]
  if (!current) return null

  const updated: Conversation = {
    ...current,
    title: safeTitle,
    updatedAt: nowIso(),
  }
  data.conversations[index] = updated
  writeStore(data)
  return updated
}

export function appendMessages(
  conversationId: string,
  messages: ChatMessage[],
  titleMaybe?: string,
): Conversation {
  const data = readStore()
  const index = data.conversations.findIndex((c) => c.id === conversationId)
  if (index < 0) {
    throw new Error('Conversa não encontrada')
  }
  const current = data.conversations[index]
  if (!current) {
    throw new Error('Conversa não encontrada')
  }
  const updated: Conversation = {
    ...current,
    title: titleMaybe ?? current.title,
    updatedAt: nowIso(),
    messages: [...current.messages, ...messages],
  }
  data.conversations[index] = updated
  writeStore(data)
  return updated
}

export function makeMessage(
  role: ChatMessage['role'],
  content: string,
  model?: string,
): ChatMessage {
  return {
    id: randomUUID(),
    role,
    content,
    ...(model !== undefined ? { model } : {}),
    createdAt: nowIso(),
  }
}
