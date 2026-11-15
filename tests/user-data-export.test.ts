import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createMemory,
  listMemories,
  setMemoryStorePathForTests,
} from '../src/main/services/memory/store'
import { openRouterKeyPath } from '../src/main/services/settings/openrouter-secret'
import { defaultTokenFilePath } from '../src/main/services/spotify/tokens'
import {
  buildUserDataExport,
  deleteAllUserData,
  exportUserDataJson,
} from '../src/main/services/userData'

describe('export / delete-all user data', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'elio-data-'))
    setMemoryStorePathForTests(join(dir, 'elio-memories.json'))
  })

  afterEach(async () => {
    setMemoryStorePathForTests(null)
    await rm(dir, { recursive: true, force: true })
  })

  it('export JSON inclui memórias e nunca embeds sk-or longos do vault file', () => {
    createMemory({ content: 'Gosto de café' })

    const data = buildUserDataExport()
    expect(data.version).toBe(1)
    expect(data.memories.some((m) => m.content.includes('café'))).toBe(true)

    const json = exportUserDataJson()
    expect(json).toContain('Gosto de café')
    expect(json).not.toMatch(/sk-or-v1-[a-z0-9]{20,}/i)
    expect(json.toLowerCase()).not.toContain('accesstoken')
    expect(json.toLowerCase()).not.toContain('refreshtoken')
  })

  it('deleteAll remove memórias e arquivos de segredo no userData', async () => {
    createMemory({ content: 'Apagar-me' })
    expect(listMemories()).toHaveLength(1)

    await mkdir(join(dir, 'secrets'), { recursive: true })
    const keyPath = openRouterKeyPath(dir)
    const tokenPath = defaultTokenFilePath(dir)
    await writeFile(keyPath, Buffer.from('enc:fake'))
    await writeFile(tokenPath, Buffer.from('enc:fake'))
    await writeFile(join(dir, 'elio-chat.json'), '{"conversations":[]}')

    const result = deleteAllUserData(dir)

    expect(result.ok).toBe(true)
    expect(result.removed.memories).toBe(1)
    expect(result.removed.openRouterKey).toBe(true)
    expect(result.removed.spotifyTokens).toBe(true)
    expect(result.removed.conversations).toBe(true)
    expect(listMemories()).toHaveLength(0)
    expect(existsSync(keyPath)).toBe(false)
    expect(existsSync(tokenPath)).toBe(false)
  })
})
