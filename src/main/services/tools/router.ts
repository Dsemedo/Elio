/**
 * Intent router (PT-BR) — modelo de produto (ADR 0005 + ADR 0019):
 *
 *   voz/texto → classificar →
 *     (A) ação no PC (abrir site/pasta/arquivo/app) — allowlist
 *     (B) fato local/tempo real (hora, clima) — enrich
 *     (C) ler aba / pesquisa web leve — aba = extensão; research = open+fetch allowlist
 *     (escalate) pedido pesado → CLOUD:kind (só com BYOK)
 *     (local_reply) small talk — sem hub
 *     (D) conversa geral → LLM (cascata; legado até cérebro local cobrir mais)
 *
 * Sem multi-agente: um classificador leve + handlers allowlisted.
 */

import { detectChatToolIntent, type ChatToolIntent } from './intent'
import { parseConfirmOpen, parseDesktopOpenIntent } from './desktop'
import type { DesktopIntent } from './desktop'
import {
  parseDesktopInputIntent,
  type DesktopInputIntent,
} from './desktop/input'
import {
  parseSpotifyIntent,
  type SpotifyIntent,
} from '../spotify/intent'
import {
  parseWebContextIntent,
  type WebContextIntent,
} from './web'
import type { CloudKind } from './capabilities'
import { detectCloudEscalate } from './escalate'
import { isSmallTalk } from './smallTalk'

export type IntentLane =
  | 'pc_action' // A
  | 'local_fact' // B
  | 'web_context' // C
  | 'escalate' // CLOUD:kind
  | 'local_reply' // small talk
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
      action: 'desktop_input'
      input: DesktopInputIntent
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
      lane: 'escalate'
      kind: CloudKind
    }
  | {
      lane: 'local_reply'
      kind: 'small_talk'
    }
  | {
      lane: 'chat'
    }

/**
 * Classifica o texto do usuário numa lane.
 * Prioridade: confirmação risky → Spotify → digitar/tecla → PC open → web_context →
 * local_fact → escalate CLOUD → small talk → chat.
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

  const input = parseDesktopInputIntent(content)
  if (input) {
    return { lane: 'pc_action', action: 'desktop_input', input }
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

  const cloudKind = detectCloudEscalate(content)
  if (cloudKind) {
    return { lane: 'escalate', kind: cloudKind }
  }

  if (isSmallTalk(content)) {
    return { lane: 'local_reply', kind: 'small_talk' }
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
    case 'escalate':
      return 'Cascata (nuvem)'
    case 'local_reply':
      return 'Resposta local'
    case 'chat':
      return 'Conversa'
  }
}
