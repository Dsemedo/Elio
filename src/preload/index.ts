import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '../shared/channels'
import type {
  AppInfo,
  ChatSendInput,
  ChatSendResult,
  ChatStatus,
  Conversation,
  ConversationSummary,
  ShellState,
  SystemSnapshot,
  VoiceProgress,
  VoiceStatus,
  VoiceTranscribeInput,
  VoiceTranscribeResult,
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

  createConversation: (): Promise<Conversation> =>
    ipcRenderer.invoke(IpcChannels.CHAT_CREATE),

  getConversation: (conversationId: string): Promise<Conversation> =>
    ipcRenderer.invoke(IpcChannels.CHAT_GET, { conversationId }),

  deleteConversation: (conversationId: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IpcChannels.CHAT_DELETE, { conversationId }),

  sendMessage: (input: ChatSendInput): Promise<ChatSendResult> =>
    ipcRenderer.invoke(IpcChannels.CHAT_SEND, input),

  cancelReply: (conversationId: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IpcChannels.CHAT_CANCEL, { conversationId }),

  getVoiceStatus: (): Promise<VoiceStatus> =>
    ipcRenderer.invoke(IpcChannels.VOICE_GET_STATUS),

  ensureVoice: (): Promise<VoiceStatus> => ipcRenderer.invoke(IpcChannels.VOICE_ENSURE),

  transcribeVoice: (input: VoiceTranscribeInput): Promise<VoiceTranscribeResult> =>
    ipcRenderer.invoke(IpcChannels.VOICE_TRANSCRIBE, input),

  onVoiceProgress: (handler: (progress: VoiceProgress) => void): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      progress: VoiceProgress,
    ): void => {
      handler(progress)
    }
    ipcRenderer.on(IpcChannels.VOICE_PROGRESS, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.VOICE_PROGRESS, listener)
    }
  },

  getShellState: (): Promise<ShellState> =>
    ipcRenderer.invoke(IpcChannels.SHELL_GET_STATE),

  togglePanel: (): Promise<ShellState> =>
    ipcRenderer.invoke(IpcChannels.SHELL_TOGGLE_PANEL),

  openPanel: (): Promise<ShellState> => ipcRenderer.invoke(IpcChannels.SHELL_OPEN_PANEL),

  closePanel: (): Promise<ShellState> =>
    ipcRenderer.invoke(IpcChannels.SHELL_CLOSE_PANEL),

  showShell: (): Promise<ShellState> => ipcRenderer.invoke(IpcChannels.SHELL_SHOW),

  hideShell: (): Promise<ShellState> => ipcRenderer.invoke(IpcChannels.SHELL_HIDE),

  setBarOverlay: (open: boolean): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IpcChannels.SHELL_SET_BAR_OVERLAY, { open }),

  onShellState: (handler: (state: ShellState) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: ShellState): void => {
      handler(state)
    }
    ipcRenderer.on(IpcChannels.SHELL_STATE_CHANGED, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.SHELL_STATE_CHANGED, listener)
    }
  },

  getSystemSnapshot: (): Promise<SystemSnapshot> =>
    ipcRenderer.invoke(IpcChannels.SYSTEM_GET_SNAPSHOT),
}

export type ElioApi = typeof elioApi

contextBridge.exposeInMainWorld('elio', elioApi)
