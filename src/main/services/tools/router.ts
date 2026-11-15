/**
 * Intent router (PT-BR) — modelo de produto confirmado por Douglas:
 *
 *   voz/texto → classificar →
 *     (A) ação no PC (abrir site/pasta/arquivo/app) — allowlist
 *     (B) fato local/tempo real (hora, clima) — enrich
 *     (C) ler aba / pesquisa web leve — aba = extensão; research = open+fetch allowlist
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
import {
  parseWebContextIntent,
  type WebContextIntent,
} from './web'

export type IntentLane =
  | 'pc_action' // A
  | 'local_fact' // B
  | 'web_context' // C
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
      web: WebContextIntent
    }
  | {
      lane: 'chat'
    }

/**
 * Classifica o texto do usuário numa lane.
 * Prioridade: confirmação risky → Spotify → PC open → web_context → local_fact → chat.
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

  const web = parseWebContextIntent(content)
  if (web) {
    return { lane: 'web_context', web }
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
      return 'Contexto web'
    case 'chat':
      return 'Conversa'
  }
}
