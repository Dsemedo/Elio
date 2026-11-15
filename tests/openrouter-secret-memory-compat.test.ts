import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SecretCrypto } from '../src/main/services/secrets/crypto'
import {
  clearOpenRouterKey,
  hasStoredOpenRouterKey,
  loadOpenRouterKey,
  openRouterKeyPath,
  saveOpenRouterKey,
} from '../src/main/services/settings/openrouter-secret'

function fakeCrypto(available = true): SecretCrypto {
  return {
    isEncryptionAvailable: async () => available,
    encryptString: async (plain) =>
      Buffer.from(`enc:${Buffer.from(plain, 'utf8').toString('base64')}`, 'utf8'),
    decryptString: async (encrypted) => {
      const text = encrypted.toString('utf8')
      if (!text.startsWith('enc:')) throw new Error('bad')
      return Buffer.from(text.slice(4), 'base64').toString('utf8')
    },
  }
}

describe('OpenRouter secret (#21) — compat PJ-35', () => {
  let dir: string
  let filePath: string
  let crypto: SecretCrypto

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'elio-or-'))
    filePath = openRouterKeyPath(dir)
    crypto = fakeCrypto(true)
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('grava cifrado e lê de volta', async () => {
    const saved = await saveOpenRouterKey('sk-or-v1-secret', crypto, filePath)
    expect(saved).toEqual({ ok: true })
    expect(await hasStoredOpenRouterKey(crypto, filePath)).toBe(true)
    const raw = await readFile(filePath)
    expect(raw.toString('utf8')).not.toContain('sk-or-v1-secret')
    expect(await loadOpenRouterKey(crypto, filePath)).toBe('sk-or-v1-secret')
  })

  it('recusa gravar sem criptografia', async () => {
    const saved = await saveOpenRouterKey('sk-or-v1-secret', fakeCrypto(false), filePath)
    expect(saved.ok).toBe(false)
  })

  it('clear remove arquivo', async () => {
    await saveOpenRouterKey('sk-or-v1-secret', crypto, filePath)
    await clearOpenRouterKey(filePath)
    expect(await hasStoredOpenRouterKey(crypto, filePath)).toBe(false)
  })
})
