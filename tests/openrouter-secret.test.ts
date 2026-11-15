import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { SecretCrypto } from '../src/main/services/spotify/tokens'
import {
  clearOpenRouterKey,
  loadOpenRouterKey,
  openRouterKeyPath,
  saveOpenRouterKey,
} from '../src/main/services/settings/openrouter-secret'

function memoryCrypto(): SecretCrypto {
  return {
    isEncryptionAvailable: async () => true,
    encryptString: async (plain) => Buffer.from(`enc:${plain}`, 'utf8'),
    decryptString: async (encrypted) => {
      const text = encrypted.toString('utf8')
      if (!text.startsWith('enc:')) throw new Error('bad')
      return text.slice(4)
    },
  }
}

describe('openrouter secret store', () => {
  it('grava e lê chave cifrada; clear remove', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'elio-or-'))
    const filePath = openRouterKeyPath(dir)
    const crypto = memoryCrypto()

    const saved = await saveOpenRouterKey('sk-or-test-key-123', crypto, filePath)
    expect(saved).toEqual({ ok: true })

    const loaded = await loadOpenRouterKey(crypto, filePath)
    expect(loaded).toBe('sk-or-test-key-123')

    await clearOpenRouterKey(filePath)
    expect(await loadOpenRouterKey(crypto, filePath)).toBeNull()

    await rm(dir, { recursive: true, force: true })
  })

  it('recusa gravação sem criptografia', async () => {
    const crypto: SecretCrypto = {
      isEncryptionAvailable: async () => false,
      encryptString: async () => Buffer.alloc(0),
      decryptString: async () => '',
    }
    const result = await saveOpenRouterKey('sk-or-test-key-123', crypto, '/tmp/x.bin')
    expect(result.ok).toBe(false)
  })
})
