/**
 * Fixed IPC channel names. Renderer must not invent channel strings.
 * Keep this file free of runtime deps (preload sandbox).
 */
export const IpcChannels = {
  APP_GET_INFO: 'app:getInfo',
  CHAT_LIST: 'chat:list',
  CHAT_GET: 'chat:get',
  CHAT_CREATE: 'chat:create',
  CHAT_SEND: 'chat:send',
  CHAT_CANCEL: 'chat:cancel',
  CHAT_DELETE: 'chat:delete',
  CHAT_STATUS: 'chat:status',
  VOICE_GET_STATUS: 'voice:getStatus',
  VOICE_ENSURE: 'voice:ensure',
  VOICE_TRANSCRIBE: 'voice:transcribe',
  /** Evento main → renderer (progresso de download). */
  VOICE_PROGRESS: 'voice:progress',
  SHELL_GET_STATE: 'shell:getState',
  SHELL_TOGGLE_PANEL: 'shell:togglePanel',
  SHELL_OPEN_PANEL: 'shell:openPanel',
  SHELL_CLOSE_PANEL: 'shell:closePanel',
  SHELL_SHOW: 'shell:show',
  SHELL_HIDE: 'shell:hide',
  /** Expande a janela da barra p/ overlay (menu) sem chrome preto. */
  SHELL_SET_BAR_OVERLAY: 'shell:setBarOverlay',
  /** Evento main → renderer (estado da shell). */
  SHELL_STATE_CHANGED: 'shell:stateChanged',
  SYSTEM_GET_SNAPSHOT: 'system:getSnapshot',
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
