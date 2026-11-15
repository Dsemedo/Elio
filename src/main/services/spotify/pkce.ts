import { createHash, randomBytes } from 'node:crypto'

/** Gera code_verifier (43–128 chars URL-safe) e challenge S256. */
export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = base64Url(randomBytes(32))
  const challenge = base64Url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

export function base64Url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

export function randomState(): string {
  return base64Url(randomBytes(16))
}
