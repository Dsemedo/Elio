import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { SecretCrypto } from '../secrets/crypto'

export type { SecretCrypto } from '../secrets/crypto'

/**
 * Tokens Spotify cifrados com safeStorage (API async) em userData.
 * Nunca logar access/refresh tokens.
 */

export type SpotifyTokenSet = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  tokenType: string
  scope: string
}

export type TokenPaths = {
  /** Arquivo binário cifrado. */
  filePath: string
}

export function defaultTokenFilePath(userData: string): string {
  return join(userData, 'secrets', 'spotify-tokens.bin')
}

export async function saveSpotifyTokens(
  tokens: SpotifyTokenSet,
  crypto: SecretCrypto,
  paths: TokenPaths,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!(await crypto.isEncryptionAvailable())) {
    return {
      ok: false,
      reason:
        'Criptografia do sistema indisponível — não gravo tokens do Spotify em texto puro.',
    }
  }

  const payload = JSON.stringify({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    tokenType: tokens.tokenType,
    scope: tokens.scope,
  })

  const encrypted = await crypto.encryptString(payload)
  await mkdir(dirname(paths.filePath), { recursive: true })
  await writeFile(paths.filePath, encrypted)

  return { ok: true }
}

export async function loadSpotifyTokens(
  crypto: SecretCrypto,
  paths: TokenPaths,
): Promise<SpotifyTokenSet | null> {
  if (!(await crypto.isEncryptionAvailable())) return null

  let raw: Buffer
  try {
    raw = await readFile(paths.filePath)
  } catch {
    return null
  }

  try {
    const plain = await crypto.decryptString(raw)
    const data = JSON.parse(plain) as Partial<SpotifyTokenSet>
    if (
      typeof data.accessToken !== 'string' ||
      typeof data.refreshToken !== 'string' ||
      typeof data.expiresAt !== 'number'
    ) {
      return null
    }
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
      tokenType: typeof data.tokenType === 'string' ? data.tokenType : 'Bearer',
      scope: typeof data.scope === 'string' ? data.scope : '',
    }
  } catch {
    // Arquivo corrompido / chave OS mudou — trata como desconectado.
    return null
  }
}

export async function clearSpotifyTokens(paths: TokenPaths): Promise<void> {
  try {
    await rm(paths.filePath, { force: true })
  } catch {
    // ignore
  }
}

export function isAccessTokenFresh(
  tokens: SpotifyTokenSet,
  nowMs: number = Date.now(),
  skewMs = 60_000,
): boolean {
  return tokens.expiresAt - skewMs > nowMs
}
