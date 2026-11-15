/**
 * Intent router (PT-BR) — modelo de produto confirmado por Douglas:
 *
 *   voz/texto → classificar →
 *     (A) ação no PC (abrir site/pasta/arquivo/app) — Estágio 2 neste PR
 *     (B) fato local/tempo real (hora, clima) — já via enrich
 *     (C) ler aba do browser / pesquisa web — ADIADO (extensão/CDP)
 *     (D) conversa geral → LLM
 *
 * Sem multi-agente: um classificador leve + handlers allowlisted.
 */

import { detectChatToolIntent, type ChatToolIntent } from './intent'
import { parseConfirmOpen, parseDesktopOpenIntent } from './desktop'
import type { DesktopIntent } from './desktop'
import {
  parseSpotifyIntent,
  type SpotifyIntent,
} from '../spotify/intent'

export type IntentLane =
  | 'pc_action' // A
  | 'local_fact' // B
  | 'web_context' // C — reserved, not implemented
  | 'chat' // D

export type ClassifiedIntent =
  | {
      lane: 'pc_action'
      action: 'desktop'
      desktop: DesktopIntent
      /** Confirmação explícita de path sensível */
      confirmRisky: boolean
    }
  | {
      lane: 'pc_action'
      action: 'spotify'
      spotify: SpotifyIntent
    }
  | {
      lane: 'local_fact'
      tools: ChatToolIntent
    }
  | {
      lane: 'web_context'
      /** Sempre deferred até extensão/CDP */
      deferred: true
      reason: string
    }
  | {
      lane: 'chat'
    }

const WEB_CONTEXT_RE =
  /\b(aba\s+(aberta|atual)|p[aá]gina\s+(aberta|atual)|o\s+que\s+(est[aá]|tem)\s+(n[ao]\s+)?(navegador|chrome|edge|browser)|l[eê]\s+(a\s+)?(aba|p[aá]gina)|pesquisa\s+(na\s+)?web|pesquisa\s+no\s+google|busca\s+na\s+internet)\b/i

/**
 * Classifica o texto do usuário numa lane.
 * Prioridade: confirmação risky → Spotify → PC open → web_context → local_fact → chat.
 *
 * web_context NÃO executa nada neste PR — só sinaliza para o caller
 * (hoje cai em chat com honestidade; futuro: extensão/CDP).
 */
export function classifyUserIntent(text: string): ClassifiedIntent {
  const content = text.trim()
  if (!content) return { lane: 'chat' }

  const confirmTarget = parseConfirmOpen(content)
  if (confirmTarget) {
    const asOpen = parseDesktopOpenIntent(`abre ${confirmTarget}`)
    if (asOpen) {
      return {
        lane: 'pc_action',
        action: 'desktop',
        desktop: asOpen,
        confirmRisky: true,
      }
    }
  }

  const spotify = parseSpotifyIntent(content)
  if (spotify) {
    return { lane: 'pc_action', action: 'spotify', spotify }
  }

  const desktop = parseDesktopOpenIntent(content)
  if (desktop) {
    return {
      lane: 'pc_action',
      action: 'desktop',
      desktop,
      confirmRisky: false,
    }
  }

  // C: detectar e marcar deferred — NÃO implementar leitura de aba aqui.
  if (WEB_CONTEXT_RE.test(content)) {
    return {
      lane: 'web_context',
      deferred: true,
      reason:
        'Ler a aba aberta / pesquisa web ainda não está disponível (precisa de extensão do navegador ou CDP). Por enquanto posso abrir um site se você pedir “abre o site …”.',
    }
  }

  const tools = detectChatToolIntent(content)
  if (tools.needsTime || tools.needsWeather) {
    return { lane: 'local_fact', tools }
  }

  return { lane: 'chat' }
}

export function laneLabel(lane: IntentLane): string {
  switch (lane) {
    case 'pc_action':
      return 'Ação no PC'
    case 'local_fact':
      return 'Fato local'
    case 'web_context':
      return 'Contexto web (em breve)'
    case 'chat':
      return 'Conversa'
  }
}
