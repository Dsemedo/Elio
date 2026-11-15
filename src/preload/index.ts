import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '../shared/channels'
import type {
  AppInfo,
  ChatSendInput,
  ChatSendResult,
  ChatStatus,
  Conversation,
  ConversationSummary,
} from '../shared/types'

/**
 * Minimal preload: only expose typed, allow-listed APIs.
 * No Node globals leak into the renderer (contextIsolation + sandbox).
 * Do not import Zod here — sandboxed preload cannot require arbitrary modules.
 */
const elioApi = {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IpcChannels.APP_GET_INFO),

  getChatStatus: (): Promise<ChatStatus> => ipcRenderer.invoke(IpcChannels.CHAT_STATUS),

  listConversations: (): Promise<ConversationSummary[]> =>
    ipcRenderer.invoke(IpcChannels.CHAT_LIST),

  createConversation: (): Promise<Conversation> => ipcRenderer.invoke(IpcChannels.CHAT_CREATE),

  getConversation: (conversationId: string): Promise<Conversation> =>
    ipcRenderer.invoke(IpcChannels.CHAT_GET, { conversationId }),

  deleteConversation: (conversationId: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IpcChannels.CHAT_DELETE, { conversationId }),

  sendMessage: (input: ChatSendInput): Promise<ChatSendResult> =>
    ipcRenderer.invoke(IpcChannels.CHAT_SEND, input),

  cancelReply: (conversationId: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IpcChannels.CHAT_CANCEL, { conversationId }),
}

export type ElioApi = typeof elioApi

contextBridge.exposeInMainWorld('elio', elioApi)
