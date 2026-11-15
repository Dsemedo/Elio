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
  CHAT_RENAME: 'chat:rename',
  CHAT_STATUS: 'chat:status',
  /** Evento main → renderer: conversa criada/atualizada/apagada (sync Bar ↔ Painel). */
  CHAT_UPDATED: 'chat:updated',
  /** Preferências locais + chave OpenRouter (cofre). */
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_SET_OPENROUTER_KEY: 'settings:setOpenRouterKey',
  SETTINGS_CLEAR_OPENROUTER_KEY: 'settings:clearOpenRouterKey',
  SETTINGS_PROBE_OLLAMA: 'settings:probeOllama',
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
  LOCATION_GET: 'location:get',
  LOCATION_SAVE_OS: 'location:saveOs',
  LOCATION_ENSURE_IP_FALLBACK: 'location:ensureIpFallback',
  /** OAuth PKCE Spotify — abre browser + loopback. */
  SPOTIFY_CONNECT: 'spotify:connect',
  SPOTIFY_DISCONNECT: 'spotify:disconnect',
  SPOTIFY_STATUS: 'spotify:status',
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
