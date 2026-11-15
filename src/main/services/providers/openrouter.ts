import type { AiProvider, ChatCompletionRequest, ChatCompletionResult } from './types'

const API_URL = 'https://openrouter.ai/api/v1/chat/completions'

/** Modelo gratuito padrão; sobrescreva com OPENROUTER_MODEL. */
const DEFAULT_FREE_MODEL = 'meta-llama/llama-3.2-3b-instruct:free'

function apiKey(): string | undefined {
  const key = process.env['OPENROUTER_API_KEY']?.trim()
  return key || undefined
}

function preferredModel(): string {
  return process.env['OPENROUTER_MODEL'] ?? DEFAULT_FREE_MODEL
}

export const openRouterProvider: AiProvider = {
  kind: 'openrouter',

  async isAvailable(): Promise<boolean> {
    return Boolean(apiKey())
  },

  async complete(request: ChatCompletionRequest): Promise<ChatCompletionResult> {
    const key = apiKey()
    if (!key) {
      throw new Error('OPENROUTER_API_KEY não configurada')
    }

    const model = preferredModel()
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

export function isOpenRouterConfigured(): boolean {
  return Boolean(apiKey())
}
