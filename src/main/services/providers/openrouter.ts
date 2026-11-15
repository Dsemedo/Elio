import {
  getOpenRouterModel,
  resolveOpenRouterApiKey,
} from '../settings'
import type { AiProvider, ChatCompletionRequest, ChatCompletionResult } from './types'

const API_URL = 'https://openrouter.ai/api/v1/chat/completions'

export const openRouterProvider: AiProvider = {
  kind: 'openrouter',

  async isAvailable(): Promise<boolean> {
    return Boolean(await resolveOpenRouterApiKey())
  },

  async complete(request: ChatCompletionRequest): Promise<ChatCompletionResult> {
    const key = await resolveOpenRouterApiKey()
    if (!key) {
      throw new Error('OpenRouter não configurado — salve a chave em Configurações')
    }

    const model = getOpenRouterModel()
    const init: RequestInit = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/Dsemedo/Elio',
        'X-Title': 'Elio',
      },
      body: JSON.stringify({
        model,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    }
    if (request.signal) {
      init.signal = request.signal
    }
    const res = await fetch(API_URL, init)

    if (!res.ok) {
      // Nunca incluir headers/body com key nos logs — só status genérico.
      throw new Error(`OpenRouter respondeu ${res.status}`)
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
      model?: string
    }
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) {
      throw new Error('OpenRouter devolveu resposta vazia')
    }

    return {
      content,
      model: data.model ?? model,
      provider: 'openrouter',
    }
  },
}

export async function isOpenRouterConfigured(): Promise<boolean> {
  return Boolean(await resolveOpenRouterApiKey())
}
