import { ipcMain } from 'electron'
import {
  ChatCancelInputSchema,
  ChatSendInputSchema,
  ConversationIdSchema,
  IpcChannels,
  type ChatSendResult,
  type Conversation,
} from '../../shared/ipc'
import { routeCompletion, getChatStatus } from '../services/router'
import {
  appendMessages,
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  makeMessage,
} from '../services/store'

const inflight = new Map<string, AbortController>()

function titleFromPrompt(content: string): string {
  const compact = content.replace(/\s+/g, ' ').trim()
  return compact.length > 48 ? `${compact.slice(0, 45)}…` : compact
}

export function registerChatIpc(): void {
  ipcMain.handle(IpcChannels.CHAT_STATUS, async () => getChatStatus())

  ipcMain.handle(IpcChannels.CHAT_LIST, () => listConversations())

  ipcMain.handle(IpcChannels.CHAT_CREATE, () => createConversation())

  ipcMain.handle(IpcChannels.CHAT_GET, (_event, raw: unknown) => {
    const { conversationId } = ConversationIdSchema.parse(raw)
    const conversation = getConversation(conversationId)
    if (!conversation) {
      throw new Error('Conversa não encontrada')
    }
    return conversation
  })

  ipcMain.handle(IpcChannels.CHAT_DELETE, (_event, raw: unknown) => {
    const { conversationId } = ConversationIdSchema.parse(raw)
    inflight.get(conversationId)?.abort()
    inflight.delete(conversationId)
    return { ok: deleteConversation(conversationId) }
  })

  ipcMain.handle(IpcChannels.CHAT_CANCEL, (_event, raw: unknown) => {
    const { conversationId } = ChatCancelInputSchema.parse(raw)
    const controller = inflight.get(conversationId)
    if (controller) {
      controller.abort()
      inflight.delete(conversationId)
      return { ok: true }
    }
    return { ok: false }
  })

  ipcMain.handle(IpcChannels.CHAT_SEND, async (_event, raw: unknown): Promise<ChatSendResult> => {
    const input = ChatSendInputSchema.parse(raw)
    const existing = getConversation(input.conversationId)
    if (!existing) {
      throw new Error('Conversa não encontrada')
    }

    if (inflight.has(input.conversationId)) {
      throw new Error('Já existe uma resposta em andamento nesta conversa')
    }

    const userMessage = makeMessage('user', input.content)
    const title =
      existing.messages.length === 0 ? titleFromPrompt(input.content) : existing.title

    // Persiste a mensagem do usuário antes da chamada ao modelo.
    let conversation = appendMessages(input.conversationId, [userMessage], title)

    const controller = new AbortController()
    inflight.set(input.conversationId, controller)

    try {
      const history = conversation.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }))

      const completion = await routeCompletion({
        messages: history,
        signal: controller.signal,
      })

      const reply = makeMessage('assistant', completion.content, completion.model)
      conversation = appendMessages(input.conversationId, [reply])

      return {
        conversation,
        reply,
        provider: completion.provider,
        model: completion.model,
      }
    } catch (err) {
      if (controller.signal.aborted) {
        throw new Error('Resposta cancelada')
      }
      const message = err instanceof Error ? err.message : 'Falha ao obter resposta'
      // Sem conteúdo de mensagem / keys nos logs.
      console.error('[elio] chat:send falhou', { conversationId: input.conversationId })
      throw new Error(message)
    } finally {
      inflight.delete(input.conversationId)
    }
  })
}

export type { Conversation }
