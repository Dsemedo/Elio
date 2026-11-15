/**
 * Fixed IPC channel names. Renderer must not invent channel strings.
 * Sprint 0: only a health/ping stub — chat/voice arrive in later sprints.
 */
export const IpcChannels = {
  APP_GET_INFO: 'app:getInfo',
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]

export type AppInfo = {
  name: string
  version: string
  electron: string
  platform: NodeJS.Platform
}
