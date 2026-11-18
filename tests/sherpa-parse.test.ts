import { describe, expect, it } from 'vitest'
import { parseSherpaStdout } from '../src/main/services/voice/sherpa/parseOutput'
import {
  SHERPA_RELEASE,
  sherpaBinaryArchiveUrl,
  sherpaOfflineCliName,
} from '../src/main/services/voice/sherpa/constants'

describe('parseSherpaStdout', () => {
  it('extrai text do JSON', () => {
    const stdout =
      'noise\n{"lang":"","text":"Abre o Chrome","tokens":[]}\n'
    expect(parseSherpaStdout(stdout)).toBe('Abre o Chrome')
  })

  it('usa a última linha JSON válida', () => {
    const stdout = [
      '{"text":"primeira"}',
      '{"text":"oi tudo bem"}',
    ].join('\n')
    expect(parseSherpaStdout(stdout)).toBe('oi tudo bem')
  })

  it('vazio se não houver texto', () => {
    expect(parseSherpaStdout('')).toBe('')
    expect(parseSherpaStdout('{"lang":""}')).toBe('')
  })
})

describe('sherpa constants', () => {
  it('pin e URLs Win/Linux', () => {
    expect(SHERPA_RELEASE).toBe('v2.0.1')
    expect(sherpaOfflineCliName('win32')).toBe('sherpa-onnx-offline.exe')
    expect(sherpaOfflineCliName('linux')).toBe('sherpa-onnx-offline')
    expect(sherpaBinaryArchiveUrl('win32')).toContain('win-x64')
    expect(sherpaBinaryArchiveUrl('linux')).toContain('linux-x64')
    expect(sherpaBinaryArchiveUrl('darwin')).toBeNull()
  })
})
