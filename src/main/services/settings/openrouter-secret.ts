import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { SecretCrypto } from '../spotify/tokens'

/**
 * Chave OpenRouter cifrada com safeStorage (mesmo padrão async do Spotify).
 * Nunca logar o valor da chave.
 */

export function openRouterKeyPath(userData: string): string {
  return join(userData, 'secrets', 'openrouter-key.bin')
}

export async function saveOpenRouterKey(
  apiKey: string,
  crypto: SecretCrypto,
  filePath: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const trimmed = apiKey.trim()
  if (!trimmed) {
    return { ok: false, reason: 'Chave vazia' }
  }
  if (!(await crypto.isEncryptionAvailable())) {
    return {
      ok: false,
      reason:
        'Criptografia do sistema indisponível — não gravo a chave em texto puro.',
    }
  }

  const encrypted = await crypto.encryptString(trimmed)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, encrypted)
  return { ok: true }
}

export async function loadOpenRouterKey(
  crypto: SecretCrypto,
  filePath: string,
): Promise<string | null> {
  if (!(await crypto.isEncryptionAvailable())) return null
  let raw: Buffer
  try {
    raw = await readFile(filePath)
  } catch {
    return null
  }
  try {
    const plain = (await crypto.decryptString(raw)).trim()
    return plain || null
  } catch {
    return null
  }
}

export async function clearOpenRouterKey(filePath: string): Promise<void> {
  try {
    await rm(filePath, { force: true })
  } catch {
    /* ignore */
  }
}

export async function hasStoredOpenRouterKey(
  crypto: SecretCrypto,
  filePath: string,
): Promise<boolean> {
  return Boolean(await loadOpenRouterKey(crypto, filePath))
}
