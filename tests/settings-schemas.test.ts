import { describe, expect, it } from 'vitest'
import {
  ChatRenameInputSchema,
  IpcChannels,
  SettingsOpenRouterKeyInputSchema,
  SettingsPublicSchema,
  SettingsUpdateInputSchema,
} from '../src/shared/ipc'

describe('settings + rename IPC', () => {
  it('expõe canais de settings e rename', () => {
    expect(IpcChannels.CHAT_RENAME).toBe('chat:rename')
    expect(IpcChannels.SETTINGS_GET).toBe('settings:get')
    expect(IpcChannels.SETTINGS_SET_OPENROUTER_KEY).toBe('settings:setOpenRouterKey')
    expect(IpcChannels.SETTINGS_PROBE_OLLAMA).toBe('settings:probeOllama')
  })

  it('valida rename', () => {
    const parsed = ChatRenameInputSchema.parse({
      conversationId: 'c1',
      title: '  Meu título  ',
    })
    expect(parsed.title).toBe('Meu título')
    expect(() =>
      ChatRenameInputSchema.parse({ conversationId: 'c1', title: '   ' }),
    ).toThrow()
  })

  it('valida settings públicos sem chave', () => {
    const status = SettingsPublicSchema.parse({
      ollamaHost: 'http://127.0.0.1:11434',
      ollamaModel: 'llama3.2',
      openRouterModel: 'meta-llama/llama-3.2-3b-instruct:free',
      weatherCity: '',
      openRouterKeyConfigured: false,
      openRouterKeySource: 'none',
      encryptionAvailable: true,
    })
    expect(status.openRouterKeySource).toBe('none')
  })

  it('valida update e chave (mín. 8 chars)', () => {
    expect(
      SettingsUpdateInputSchema.parse({ weatherCity: 'Campinas' }).weatherCity,
    ).toBe('Campinas')
    expect(
      SettingsOpenRouterKeyInputSchema.parse({ apiKey: 'sk-or-v1-abcdefgh' }).apiKey,
    ).toBe('sk-or-v1-abcdefgh')
    expect(() =>
      SettingsOpenRouterKeyInputSchema.parse({ apiKey: 'short' }),
    ).toThrow()
  })
})
