import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readSettingsFile, writeSettingsFile } from '../src/main/services/settings/file'

describe('elio-settings.json', () => {
  it('persiste prefs sem secrets', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'elio-set-'))
    writeSettingsFile(dir, {
      ollamaHost: 'http://127.0.0.1:11434',
      ollamaModel: 'llama3.2',
      weatherCity: 'Campinas',
      openRouterModel: 'meta-llama/llama-3.2-3b-instruct:free',
    })
    const read = readSettingsFile(dir)
    expect(read.weatherCity).toBe('Campinas')
    expect(read.ollamaModel).toBe('llama3.2')
    expect(JSON.stringify(read)).not.toMatch(/sk-|apiKey|secret/i)
    await rm(dir, { recursive: true, force: true })
  })
})
