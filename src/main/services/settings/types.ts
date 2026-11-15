/** Preferências locais não secretas (JSON em userData). */
export type ElioSettings = {
  ollamaHost?: string
  ollamaModel?: string
  openRouterModel?: string
  weatherCity?: string
}

export type SettingsPublic = {
  ollamaHost: string
  ollamaModel: string
  openRouterModel: string
  weatherCity: string
  openRouterKeyConfigured: boolean
  openRouterKeySource: 'env' | 'store' | 'none'
  encryptionAvailable: boolean
}

export const DEFAULT_OLLAMA_HOST = 'http://127.0.0.1:11434'
export const DEFAULT_OLLAMA_MODEL = 'llama3.2'
export const DEFAULT_OPENROUTER_MODEL = 'meta-llama/llama-3.2-3b-instruct:free'
