import { app, shell } from 'electron'
import type { SpotifyIntent } from './intent'
import {
  parseSpotifyIntent,
  describeSpotifyIntent,
  looksLikeSpotifyCommand,
} from './intent'
import {
  handleSpotifyIntent,
  electronSpotifyPaths,
  type SpotifyActionResult,
  type SpotifyRuntime,
} from './play'
import { clearSpotifyTokens, loadSpotifyTokens } from './tokens'
import { electronSecretCrypto } from '../secrets/crypto'
import { isSpotifyClientConfigured } from './config'
import { validateSpotifyExternalUrl } from './urls'

export { electronSecretCrypto } from '../secrets/crypto'
export type { SecretCrypto } from '../secrets/crypto'

export {
  parseSpotifyIntent,
  describeSpotifyIntent,
  looksLikeSpotifyCommand,
  validateSpotifyExternalUrl,
  isSpotifyClientConfigured,
  handleSpotifyIntent,
}
export type { SpotifyIntent, SpotifyActionResult }

function resolveUserDataPath(): string | null {
  try {
    if (app && typeof app.getPath === 'function') {
      return app.getPath('userData')
    }
  } catch {
    // Fora do processo Electron (unit tests).
  }
  return null
}

export function createElectronSpotifyRuntime(
  env: NodeJS.ProcessEnv = process.env,
): SpotifyRuntime {
  const userData = resolveUserDataPath()
  if (!userData) {
    throw new Error('userData do Electron indisponível para Spotify')
  }
  return {
    crypto: electronSecretCrypto(),
    paths: electronSpotifyPaths(userData),
    opener: {
      openExternal: async (url) => {
        await shell.openExternal(url)
      },
    },
    env,
  }
}

export async function getSpotifyConnectionStatus(
  env: NodeJS.ProcessEnv = process.env,
): Promise<{
  clientConfigured: boolean
  connected: boolean
  encryptionAvailable: boolean
}> {
  const clientConfigured = isSpotifyClientConfigured(env)
  const userData = resolveUserDataPath()
  if (!userData) {
    return {
      clientConfigured,
      connected: false,
      encryptionAvailable: false,
    }
  }
  const crypto = electronSecretCrypto()
  const paths = electronSpotifyPaths(userData)
  const tokens = await loadSpotifyTokens(crypto, paths)
  return {
    clientConfigured,
    connected: Boolean(tokens),
    encryptionAvailable: await crypto.isEncryptionAvailable(),
  }
}

export async function disconnectSpotify(): Promise<void> {
  const userData = resolveUserDataPath()
  if (!userData) return
  await clearSpotifyTokens(electronSpotifyPaths(userData))
}

export async function runSpotifyIntent(
  intent: SpotifyIntent,
): Promise<SpotifyActionResult> {
  return handleSpotifyIntent(intent, createElectronSpotifyRuntime())
}
