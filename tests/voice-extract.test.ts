import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Valida o layout do asset Windows v1.9.2 (Release/whisper-cli.exe + DLLs).
 * No app Windows o extract usa tar.exe (bsdtar); aqui no CI Linux usamos unzip.
 */
describe('layout do binário Whisper Windows', () => {
  it('pacote whisper-bin-x64.zip contém whisper-cli.exe e DLLs', () => {
    const cached = '/tmp/whisper-test/whisper-bin-x64.zip'
    const zipPath = existsSync(cached)
      ? cached
      : join(tmpdir(), 'elio-whisper-bin-x64.zip')
    if (!existsSync(zipPath)) {
      execFileSync(
        'curl',
        [
          '-sL',
          '-o',
          zipPath,
          'https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.2/whisper-bin-x64.zip',
        ],
        { stdio: 'pipe' },
      )
    }

    const extractDir = mkdtempSync(join(tmpdir(), 'elio-whisper-extract-'))
    try {
      execFileSync('unzip', ['-o', zipPath, '-d', extractDir], { stdio: 'pipe' })
      const cli = join(extractDir, 'Release', 'whisper-cli.exe')
      expect(existsSync(cli)).toBe(true)
      const releaseEntries = readdirSync(join(extractDir, 'Release'))
      expect(releaseEntries).toEqual(expect.arrayContaining(['whisper.dll', 'ggml.dll']))
    } finally {
      rmSync(extractDir, { recursive: true, force: true })
    }
  })
})
