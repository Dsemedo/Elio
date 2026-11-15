/** Camada da cascata de IA (PJ-34). */
export type RouteTier = 'byok' | 'free' | 'local' | 'tool'

/** Modelo gratuito padrão no OpenRouter (OD-03). */
export const OPENROUTER_DEFAULT_FREE_MODEL =
  'meta-llama/llama-3.2-3b-instruct:free'

export function isFreeOpenRouterModel(model: string): boolean {
  return model.trim().toLowerCase().includes(':free')
}

export function routeTierLabel(tier: RouteTier): string {
  switch (tier) {
    case 'byok':
      return 'BYOK'
    case 'free':
      return 'cota grátis'
    case 'local':
      return 'local'
    case 'tool':
      return 'ferramenta'
  }
}

export function servedByLabel(
  provider: 'openrouter' | 'ollama' | 'elio',
  tier: RouteTier,
  model: string,
): string {
  if (provider === 'elio' || tier === 'tool') {
    return `Elio · ${model}`
  }
  if (provider === 'ollama') {
    return `Ollama (local) · ${model}`
  }
  if (tier === 'byok') {
    return `OpenRouter (BYOK) · ${model}`
  }
  return `OpenRouter (cota grátis) · ${model}`
}
