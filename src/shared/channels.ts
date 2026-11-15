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
  SETTINGS_EXPORT_DATA: 'settings:exportData',
  SETTINGS_DELETE_ALL_DATA: 'settings:deleteAllData',
  /** Memórias explícitas (CRUD local). */
  MEMORY_LIST: 'memory:list',
  MEMORY_CREATE: 'memory:create',
  MEMORY_UPDATE: 'memory:update',
  MEMORY_DELETE: 'memory:delete',
  VOICE_GET_STATUS: 'voice:getStatus',
  VOICE_ENSURE: 'voice:ensure',
  VOICE_TRANSCRIBE: 'voice:transcribe',
  /** Estado SO do microfone (Windows/macOS getMediaAccessStatus). */
  VOICE_GET_MIC_ACCESS: 'voice:getMicAccess',
  /** Evento main → renderer (progresso de download). */
  VOICE_PROGRESS: 'voice:progress',
  /** Preferências + síntese TTS (edge-tts no main; system no renderer). */
  TTS_GET_SETTINGS: 'tts:getSettings',
  TTS_SET_SETTINGS: 'tts:setSettings',
  TTS_SYNTHESIZE: 'tts:synthesize',
  TTS_STOP: 'tts:stop',
  /** Evento main → renderer: settings TTS mudaram. */
  TTS_SETTINGS_CHANGED: 'tts:settingsChanged',
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
