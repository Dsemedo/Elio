import type { AiProvider, ChatCompletionRequest, ChatCompletionResult } from './types'

const DEFAULT_BASE = 'http://127.0.0.1:11434'

function baseUrl(): string {
  return (process.env['OLLAMA_HOST'] ?? DEFAULT_BASE).replace(/\/$/, '')
}

function preferredModel(): string {
  return process.env['OLLAMA_MODEL'] ?? 'llama3.2'
}

export const ollamaProvider: AiProvider = {
  kind: 'ollama',

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 1500)
      const res = await fetch(`${baseUrl()}/api/tags`, { signal: controller.signal })
      clearTimeout(timer)
      return res.ok
    } catch {
      return false
    }
  },

  async complete(request: ChatCompletionRequest): Promise<ChatCompletionResult> {
    const model = preferredModel()
    const init: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    }
    if (request.signal) {
      init.signal = request.signal
    }
    const res = await fetch(`${baseUrl()}/api/chat`, init)

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(
        `Ollama respondeu ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`,
      )
    }

    const data = (await res.json()) as {
      message?: { content?: string }
      model?: string
    }
    const content = data.message?.content?.trim()
    if (!content) {
      throw new Error('Ollama devolveu resposta vazia')
    }

    return {
      content,
      model: data.model ?? model,
      provider: 'ollama',
    }
  },
}
