import type { Memory } from './store'
import { listMemories } from './store'

/** Limite de chars no bloco de memórias do system prompt (evita estourar contexto). */
export const MEMORY_PROMPT_BUDGET = 3500

/**
 * Formata memórias explícitas para injeção no system prompt.
 * Ordem: mais recentes primeiro; corta pelo orçamento de caracteres.
 */
export function formatMemoriesForPrompt(
  memories: Memory[],
  budget = MEMORY_PROMPT_BUDGET,
): string | null {
  if (memories.length === 0) return null

  const header =
    'Memórias explícitas do usuário (fatos que ele pediu para lembrar — use quando relevante; não invente memórias):'
  const lines: string[] = [header]
  let used = header.length

  for (const memory of memories) {
    const tagSuffix = memory.tags.length > 0 ? ` [${memory.tags.join(', ')}]` : ''
    const line = `- ${memory.content}${tagSuffix}`
    if (used + line.length + 1 > budget) {
      lines.push('- (outras memórias omitidas por limite de contexto)')
      break
    }
    lines.push(line)
    used += line.length + 1
  }

  return lines.join('\n')
}

export function loadMemoriesPromptBlock(): string | null {
  try {
    return formatMemoriesForPrompt(listMemories())
  } catch {
    // Fora do Electron / store indisponível — não derruba o chat.
    return null
  }
}
