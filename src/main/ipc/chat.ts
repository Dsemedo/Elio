import { BrowserWindow, ipcMain } from 'electron'
import {
  ChatCancelInputSchema,
  ChatRenameInputSchema,
  ChatUpdatedEventSchema,
  ChatSendInputSchema,
  ConversationIdSchema,
  IpcChannels,
  type ChatSendResult,
  type ChatUpdatedEvent,
  type Conversation,
} from '../../shared/ipc'
import {
  electronDesktopOpener,
  executeDesktopIntent,
} from '../services/tools/desktop'
import { enrichMessagesWithLocalFacts } from '../services/tools/enrich'
import { classifyUserIntent } from '../services/tools/router'
import { routeCompletion, getChatStatus } from '../services/router'
import { runSpotifyIntent } from '../services/spotify'
import {
  appendMessages,
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  makeMessage,
  renameConversation,
} from '../services/store'

const inflight = new Map<string, AbortController>()

function titleFromPrompt(content: string): string {
  const compact = content.replace(/\s+/g, ' ').trim()
  return compact.length > 48 ? `${compact.slice(0, 45)}…` : compact
}

function broadcastChatUpdated(event: ChatUpdatedEvent): void {
  const payload = ChatUpdatedEventSchema.parse(event)
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    win.webContents.send(IpcChannels.CHAT_UPDATED, payload)
  }
}

async function finishAssistantReply(
  conversationId: string,
  content: string,
  model: string,
): Promise<ChatSendResult> {
  const reply = makeMessage('assistant', content, model)
  const conversation = appendMessages(conversationId, [reply])
  broadcastChatUpdated({
    reason: 'updated',
    conversationId: conversation.id,
    conversation,
  })
  const status = await getChatStatus()
  return {
    conversation,
    reply,
    provider: status.preferredProvider,
    model,
  }
}

export function registerChatIpc(): void {
  ipcMain.handle(IpcChannels.CHAT_STATUS, async () => getChatStatus())

  ipcMain.handle(IpcChannels.CHAT_LIST, () => listConversations())

  ipcMain.handle(IpcChannels.CHAT_CREATE, () => {
    const created = createConversation()
    broadcastChatUpdated({
      reason: 'created',
      conversationId: created.id,
      conversation: created,
    })
    return created
  })

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
    const ok = deleteConversation(conversationId)
    if (ok) {
      broadcastChatUpdated({ reason: 'deleted', conversationId })
    }
    return { ok }
  })

  ipcMain.handle(IpcChannels.CHAT_RENAME, (_event, raw: unknown) => {
    const input = ChatRenameInputSchema.parse(raw)
    const conversation = renameConversation(input.conversationId, input.title)
    if (!conversation) {
      throw new Error('Não foi possível renomear a conversa')
    }
    broadcastChatUpdated({
      reason: 'updated',
      conversationId: conversation.id,
      conversation,
    })
    return conversation
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
    broadcastChatUpdated({
      reason: 'updated',
      conversationId: conversation.id,
      conversation,
    })

    const controller = new AbortController()
    inflight.set(input.conversationId, controller)

    try {
      /**
       * Router de intents (PT-BR):
       * A = pc_action · B = local_fact (enrich) · C = web_context (deferred) · D = chat/LLM
       */
      const classified = classifyUserIntent(input.content)

      if (classified.lane === 'pc_action') {
        if (classified.action === 'spotify') {
          const result = await runSpotifyIntent(classified.spotify)
          return finishAssistantReply(
            input.conversationId,
            result.message,
            'elio-spotify',
          )
        }
        const result = await executeDesktopIntent(
          classified.desktop,
          electronDesktopOpener(),
          { confirmRisky: classified.confirmRisky },
        )
        return finishAssistantReply(
          input.conversationId,
          result.message,
          'elio-desktop',
        )
      }

      if (classified.lane === 'web_context') {
        // C adiado de propósito — sem CDP/extensão neste PR.
        return finishAssistantReply(
          input.conversationId,
          classified.reason,
          'elio-deferred',
        )
      }

      // B (hora/clima) + D (chat): enrich injeta fatos locais quando detectChatToolIntent pede.
      const history = conversation.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }))

      const messages = await enrichMessagesWithLocalFacts(history, controller.signal)

      const completion = await routeCompletion({
        messages,
        signal: controller.signal,
      })

      const reply = makeMessage('assistant', completion.content, completion.model)
      conversation = appendMessages(input.conversationId, [reply])
      broadcastChatUpdated({
        reason: 'updated',
        conversationId: conversation.id,
        conversation,
      })

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
