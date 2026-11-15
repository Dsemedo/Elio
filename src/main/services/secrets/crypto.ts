import { safeStorage } from 'electron'

/**
 * Abstração async de cifrar/decifrar — alinha com safeStorage async do Electron 45+.
 * Usado por Spotify tokens e API keys (OpenRouter) no MVP.
 * keytar arquivado (OD-01) — safeStorage evita native addon.
 */
export type SecretCrypto = {
  isEncryptionAvailable: () => Promise<boolean>
  encryptString: (plain: string) => Promise<Buffer>
  decryptString: (encrypted: Buffer) => Promise<string>
}

/**
 * Wrapper Electron safeStorage (API async — sync deprecado no 45, removido no 46).
 * Tokens/keys antigos cifrados com encryptString sync ainda descriptografam via decryptStringAsync.
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
