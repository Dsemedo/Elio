import { describe, expect, it } from 'vitest'
import {
  ChatSendInputSchema,
  ChatStatusSchema,
  ChatUpdatedEventSchema,
  IpcChannels,
} from '../src/shared/ipc'

describe('chat IPC contracts', () => {
  it('expõe canais de chat fixos', () => {
    expect(IpcChannels.CHAT_SEND).toBe('chat:send')
    expect(IpcChannels.CHAT_CANCEL).toBe('chat:cancel')
    expect(IpcChannels.CHAT_UPDATED).toBe('chat:updated')
    expect(Object.values(IpcChannels).every((c) => c.includes(':'))).toBe(true)
  })

  it('valida evento de sync chat:updated', () => {
    const event = ChatUpdatedEventSchema.parse({
      reason: 'updated',
      conversationId: 'c1',
    })
    expect(event.reason).toBe('updated')
  })

  it('valida envio de mensagem', () => {
    const parsed = ChatSendInputSchema.parse({
      conversationId: 'abc',
      content: '  Olá Elio  ',
    })
    expect(parsed.content).toBe('Olá Elio')
  })

  it('rejeita mensagem vazia', () => {
    expect(() =>
      ChatSendInputSchema.parse({ conversationId: 'abc', content: '   ' }),
    ).toThrow()
  })

  it('aceita status de provedor com cascata e budget stub', () => {
    const status = ChatStatusSchema.parse({
      ollamaAvailable: false,
      openRouterConfigured: false,
      preferredProvider: 'none',
      preferredTier: 'none',
      cascadeOrder: ['byok', 'free', 'local'],
      hint: 'configure',
      budget: {
        byokUsed: 0,
        freeUsed: 0,
        localUsed: 0,
        byokLimit: null,
        freeLimit: null,
        localLimit: null,
        enforce: false,
      },
      spotifyClientConfigured: false,
      spotifyConnected: false,
    })
    expect(status.preferredProvider).toBe('none')
    expect(status.cascadeOrder[0]).toBe('byok')
    expect(status.spotifyConnected).toBe(false)
  })
})
