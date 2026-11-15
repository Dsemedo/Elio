import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '../shared/channels'
import type {
  AppInfo,
  AppLocation,
  ChatRenameInput,
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
  UserDataExportPayload,
  LocationSaveOsInput,
  SettingsOpenRouterKeyInput,
  SettingsPublic,
  SettingsUpdateInput,
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

  renameConversation: (input: ChatRenameInput): Promise<Conversation> =>
    ipcRenderer.invoke(IpcChannels.CHAT_RENAME, input),

  sendMessage: (input: ChatSendInput): Promise<ChatSendResult> =>
    ipcRenderer.invoke(IpcChannels.CHAT_SEND, input),

  getSettings: (): Promise<SettingsPublic> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_GET),

  updateSettings: (input: SettingsUpdateInput): Promise<SettingsPublic> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_UPDATE, input),

  setOpenRouterKey: (input: SettingsOpenRouterKeyInput): Promise<SettingsPublic> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_SET_OPENROUTER_KEY, input),

  clearOpenRouterKey: (): Promise<SettingsPublic> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_CLEAR_OPENROUTER_KEY),

  probeOllama: (): Promise<{ ok: boolean; host: string; message: string }> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_PROBE_OLLAMA),

  cancelReply: (conversationId: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IpcChannels.CHAT_CANCEL, { conversationId }),

  onChatUpdated: (handler: (event: ChatUpdatedEvent) => void): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: ChatUpdatedEvent,
    ): void => {
      handler(payload)
    }
    ipcRenderer.on(IpcChannels.CHAT_UPDATED, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.CHAT_UPDATED, listener)
    }
  },

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

  getLocation: (): Promise<AppLocation | null> =>
    ipcRenderer.invoke(IpcChannels.LOCATION_GET),

  saveOsLocation: (input: LocationSaveOsInput): Promise<AppLocation> =>
    ipcRenderer.invoke(IpcChannels.LOCATION_SAVE_OS, input),

  ensureIpLocationFallback: (): Promise<AppLocation | null> =>
    ipcRenderer.invoke(IpcChannels.LOCATION_ENSURE_IP_FALLBACK),

  getSpotifyStatus: (): Promise<{
    clientConfigured: boolean
    connected: boolean
    encryptionAvailable: boolean
  }> => ipcRenderer.invoke(IpcChannels.SPOTIFY_STATUS),

  connectSpotify: (): Promise<{
    ok: boolean
    message: string
    status: {
      clientConfigured: boolean
      connected: boolean
      encryptionAvailable: boolean
    }
  }> => ipcRenderer.invoke(IpcChannels.SPOTIFY_CONNECT),

  disconnectSpotify: (): Promise<{
    ok: boolean
    message: string
    status: {
      clientConfigured: boolean
      connected: boolean
      encryptionAvailable: boolean
    }
  }> => ipcRenderer.invoke(IpcChannels.SPOTIFY_DISCONNECT),
  listMemories: (): Promise<Memory[]> => ipcRenderer.invoke(IpcChannels.MEMORY_LIST),

  createMemory: (input: MemoryCreateInput): Promise<Memory> =>
    ipcRenderer.invoke(IpcChannels.MEMORY_CREATE, input),

  updateMemory: (input: MemoryUpdateInput): Promise<Memory> =>
    ipcRenderer.invoke(IpcChannels.MEMORY_UPDATE, input),

  deleteMemory: (id: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IpcChannels.MEMORY_DELETE, { id }),

  exportUserData: (): Promise<UserDataExportPayload> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_EXPORT_DATA),

  deleteAllUserData: (): Promise<DeleteAllDataResult> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_DELETE_ALL_DATA),

}

export type ElioApi = typeof elioApi

contextBridge.exposeInMainWorld('elio', elioApi)
