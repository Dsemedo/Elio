import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { listConversations, getConversation } from './store'
import { clearAllMemories, listMemories, defaultMemoryStorePath } from './memory/store'
import { clearCachedLocation, readCachedLocation } from './location/cache'
import { openRouterKeyPath } from './settings/openrouter-secret'
import { defaultTokenFilePath } from './spotify/tokens'

/**
 * Exportar / apagar dados locais do usuário (OD-18 / security.md).
 * Export NUNCA inclui API keys nem tokens Spotify.
 */

export type UserDataExport = {
  exportedAt: string
  version: 1
  app: 'elio'
  conversations: NonNullable<ReturnType<typeof getConversation>>[]
  memories: ReturnType<typeof listMemories>
  location: {
    name: string
    source: string
    updatedAt: string
    permissionDenied?: boolean
  } | null
}

export type DeleteAllResult = {
  ok: true
  removed: {
    conversations: boolean
    memories: number
    location: boolean
    openRouterKey: boolean
    spotifyTokens: boolean
  }
}

function resolveUserData(): string {
  try {
    if (app && typeof app.getPath === 'function') {
      return app.getPath('userData')
    }
  } catch {
    /* ignore */
  }
  throw new Error('userData do Electron indisponível')
}

function chatStorePath(userData: string): string {
  return join(userData, 'elio-chat.json')
}

function removeFileIfExists(path: string): boolean {
  if (!existsSync(path)) return false
  try {
    rmSync(path, { force: true })
    return true
  } catch {
    return false
  }
}

export function buildUserDataExport(): UserDataExport {
  let conversations: NonNullable<ReturnType<typeof getConversation>>[] = []
  try {
    const summaries = listConversations()
    conversations = summaries
      .map((s) => getConversation(s.id))
      .filter((c): c is NonNullable<typeof c> => c !== null)
  } catch {
    conversations = []
  }

  let location: UserDataExport['location'] = null
  try {
    const cached = readCachedLocation()
    location = cached
      ? {
          name: cached.name,
          source: cached.source,
          updatedAt: cached.updatedAt,
          ...(cached.permissionDenied !== undefined
            ? { permissionDenied: cached.permissionDenied }
            : {}),
        }
      : null
  } catch {
    location = null
  }

  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    app: 'elio',
    conversations,
    memories: listMemories(),
    location,
  }
}

export function exportUserDataJson(): string {
  return JSON.stringify(buildUserDataExport(), null, 2)
}

/**
 * Apaga conversas, memórias, cache de localização e segredos locais.
 * Não remove o binário Whisper nem preferências de SO.
 */
export function deleteAllUserData(userData?: string): DeleteAllResult {
  const root = userData ?? resolveUserData()

  const conversations = removeFileIfExists(chatStorePath(root))
  const memories = clearAllMemories()
  removeFileIfExists(defaultMemoryStorePath(root))

  let hadLocation = false
  try {
    hadLocation = Boolean(readCachedLocation())
    clearCachedLocation()
  } catch {
    /* app.getPath indisponível (testes) — ainda removemos o arquivo abaixo */
  }
  if (removeFileIfExists(join(root, 'elio-location.json'))) {
    hadLocation = true
  }

  removeFileIfExists(join(root, 'elio-settings.json'))
  const openRouterKey = removeFileIfExists(openRouterKeyPath(root))
  const spotifyTokens = removeFileIfExists(defaultTokenFilePath(root))

  return {
    ok: true,
    removed: {
      conversations,
      memories,
      location: hadLocation,
      openRouterKey,
      spotifyTokens,
    },
  }
}
