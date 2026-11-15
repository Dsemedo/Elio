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
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
