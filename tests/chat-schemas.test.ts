import { describe, expect, it } from 'vitest'
import {
  ChatSendInputSchema,
  ChatStatusSchema,
  IpcChannels,
} from '../src/shared/ipc'

describe('chat IPC contracts', () => {
  it('expõe canais de chat fixos', () => {
    expect(IpcChannels.CHAT_SEND).toBe('chat:send')
    expect(IpcChannels.CHAT_CANCEL).toBe('chat:cancel')
    expect(Object.values(IpcChannels).every((c) => c.includes(':'))).toBe(true)
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

  it('aceita status de provedor', () => {
    const status = ChatStatusSchema.parse({
      ollamaAvailable: false,
      openRouterConfigured: false,
      preferredProvider: 'none',
      hint: 'configure',
    })
    expect(status.preferredProvider).toBe('none')
  })
})
