import { describe, expect, it } from 'vitest'
import {
  IpcChannels,
  TtsSetSettingsInputSchema,
  TtsSettingsSchema,
  TtsSynthesizeInputSchema,
} from '../src/shared/ipc'
import { escapeXmlForSsml, buildEdgeSsml } from '../src/main/services/tts/ssml'
import { extractAudioFromBinaryFrame } from '../src/main/services/tts/edgeTts'

describe('tts IPC contracts', () => {
  it('expõe canais TTS fixos', () => {
    expect(IpcChannels.TTS_GET_SETTINGS).toBe('tts:getSettings')
    expect(IpcChannels.TTS_SET_SETTINGS).toBe('tts:setSettings')
    expect(IpcChannels.TTS_SYNTHESIZE).toBe('tts:synthesize')
    expect(IpcChannels.TTS_STOP).toBe('tts:stop')
    expect(IpcChannels.TTS_SETTINGS_CHANGED).toBe('tts:settingsChanged')
  })

  it('valida settings', () => {
    const settings = TtsSettingsSchema.parse({
      enabled: false,
      provider: 'auto',
      edgeVoice: 'pt-BR-FranciscaNeural',
      envOverride: false,
      hint: 'off',
    })
    expect(settings.provider).toBe('auto')
  })

  it('exige ao menos um campo no set', () => {
    expect(() => TtsSetSettingsInputSchema.parse({})).toThrow()
    expect(TtsSetSettingsInputSchema.parse({ enabled: true }).enabled).toBe(true)
  })

  it('rejeita synthesize vazio', () => {
    expect(() => TtsSynthesizeInputSchema.parse({ text: '' })).toThrow()
  })
})

describe('ssml helpers', () => {
  it('escapa XML perigoso', () => {
    expect(escapeXmlForSsml(`a <b> & "c"`)).toBe('a &lt;b&gt; &amp; &quot;c&quot;')
  })

  it('monta SSML com voz limpa', () => {
    const ssml = buildEdgeSsml('Oi <mundo>', 'pt-BR-FranciscaNeural<script>')
    expect(ssml).toContain("name='pt-BR-FranciscaNeural'")
    expect(ssml).not.toContain('<script>')
    expect(ssml).toContain('Oi &lt;mundo&gt;')
  })
})

describe('edge binary frame', () => {
  it('extrai áudio após Path:audio', () => {
    const header = 'X-RequestId:abc\r\nContent-Type:audio/mpeg\r\nPath:audio\r\n\r\n'
    const payload = Buffer.from([1, 2, 3, 4])
    const frame = Buffer.concat([Buffer.from(header, 'utf8'), payload])
    expect(extractAudioFromBinaryFrame(frame)?.equals(payload)).toBe(true)
  })

  it('ignora frames sem Path:audio', () => {
    const frame = Buffer.from('Path:turn.start\r\n\r\nxxx', 'utf8')
    expect(extractAudioFromBinaryFrame(frame)).toBeNull()
  })
})
