/**
 * Sinais de escalação CLOUD:kind (ADR 0019 / Fase A0c).
 * Regras baratas antes do manifesto / hub.
 */

import type { CloudKind } from './capabilities'

const IMAGE =
  /\b(gera|gerar|crie|cria|criar|faz|fazer|desenha|desenhar|ilustra|ilustrar)\b[\s\S]{0,40}\b(imagem|imagens|foto|figure|ilustra[cç][aã]o|desenho)\b|\b(desenha|ilustra)\b/i

const CODEGEN =
  /\b(faz|fazer|gera|gerar|monta|montar|cria|criar|crie)\b[\s\S]{0,48}\b(site|landing|landing\s*page|app completo|aplicativo completo|pagina web|página web)\b/i

/**
 * Se o texto pede trabalho pesado de nuvem, devolve o kind.
 * Caso contrário null (segue small talk / chat).
 */
export function detectCloudEscalate(text: string): CloudKind | null {
  const content = text.trim()
  if (!content) return null
  if (IMAGE.test(content)) return 'image'
  if (CODEGEN.test(content)) return 'codegen'
  return null
}
