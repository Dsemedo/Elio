import { app, safeStorage, shell } from 'electron'
import type { SpotifyIntent } from './intent'
import { parseSpotifyIntent, describeSpotifyIntent, looksLikeSpotifyCommand } from './intent'
import {
  handleSpotifyIntent,
  electronSpotifyPaths,
  type SpotifyActionResult,
  type SpotifyRuntime,
} from './play'
import {
  clearSpotifyTokens,
  loadSpotifyTokens,
  type SecretCrypto,
} from './tokens'
import { isSpotifyClientConfigured } from './config'
import { validateSpotifyExternalUrl } from './urls'

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

/**
 * Wrapper Electron safeStorage (API async — sync deprecado no 45, removido no 46).
 * Tokens antigos cifrados com encryptString sync ainda descriptografam via decryptStringAsync.
 */
export function electronSecretCrypto(): SecretCrypto {
  return {
    isEncryptionAvailable: async () => {
      try {
        const asyncFn = (
          safeStorage as unknown as {
            isAsyncEncryptionAvailable?: () => Promise<boolean>
          }
        ).isAsyncEncryptionAvailable
        if (typeof asyncFn === 'function') {
          return Boolean(await asyncFn.call(safeStorage))
        }
        // Fallback só se build antigo sem API async (não deve ocorrer no pin 45.3.x).
        return Boolean(
          (
            safeStorage as unknown as {
              isEncryptionAvailable?: () => boolean
            }
          ).isEncryptionAvailable?.(),
        )
      } catch {
        return false
      }
    },
    encryptString: async (plain) => {
      const asyncFn = (
        safeStorage as unknown as {
          encryptStringAsync?: (s: string) => Promise<Buffer>
        }
      ).encryptStringAsync
      if (typeof asyncFn === 'function') {
        return asyncFn.call(safeStorage, plain)
      }
      return safeStorage.encryptString(plain)
    },
    decryptString: async (encrypted) => {
      const asyncFn = (
        safeStorage as unknown as {
          decryptStringAsync?: (
            buf: Buffer,
          ) => Promise<{ result: string; shouldReEncrypt?: boolean }>
        }
      ).decryptStringAsync
      if (typeof asyncFn === 'function') {
        const out = await asyncFn.call(safeStorage, encrypted)
        return out.result
      }
      return safeStorage.decryptString(encrypted)
    },
  }
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
