/**
 * Small talk local (ADR 0019 / Fase A0b) — sem hub / sem rede.
 */

/** Normaliza para matching: minúsculas, sem acento pesado, sem “élio/elio”. */
function normalizeSmallTalk(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\b(elio|élio)\b/gi, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const GREETING_ONLY =
  /^(oi|ola|oie|hey|eai|e ai|fala|falae|salve|bom dia|boa tarde|boa noite)(\s+(ai|aí|aew))?$/u

const HOW_ARE_YOU =
  /^(tudo bem|tudo bom|td bem|td bom|como vai|como voce esta|como voce ta|como esta|beleza)(\s+(com voce|ai|aí|vc|voce))?$/u

const GREETING_AND_HOW =
  /^(oi|ola|oie|hey|eai|bom dia|boa tarde|boa noite)(\s+\w+){0,2}\s+(tudo bem|tudo bom|como vai|como voce esta|como esta|beleza)/u

const THANKS = /^(obrigad[oa]|valeu|thanks|brigad[oa]|tmj)(\s+\w+){0,2}$/u

const BYE = /^(tchau|ate logo|ate mais|falou|flw|bye)(\s+\w+){0,2}$/u

/**
 * Detecta cumprimento / small talk curto.
 * Frases longas ou pedidos de explicação → false (ficam no chat/escalate).
 */
export function isSmallTalk(text: string): boolean {
  const n = normalizeSmallTalk(text)
  if (!n || n.length > 48) return false
  if (GREETING_AND_HOW.test(n)) return true
  if (GREETING_ONLY.test(n)) return true
  if (HOW_ARE_YOU.test(n)) return true
  if (THANKS.test(n)) return true
  if (BYE.test(n)) return true
  return false
}

export function localSmallTalkReply(text: string): string {
  const n = normalizeSmallTalk(text)

  if (THANKS.test(n)) {
    return 'Por nada — é só pedir.'
  }
  if (BYE.test(n)) {
    return 'Até mais. Estou por aqui quando precisar.'
  }
  if (GREETING_AND_HOW.test(n) || HOW_ARE_YOU.test(n)) {
    return 'Tudo bem, obrigado! Em que posso ajudar?'
  }
  if (/^bom dia/.test(n)) {
    return 'Bom dia! Em que posso ajudar?'
  }
  if (/^boa tarde/.test(n)) {
    return 'Boa tarde! Em que posso ajudar?'
  }
  if (/^boa noite/.test(n)) {
    return 'Boa noite! Em que posso ajudar?'
  }
  return 'Oi! Em que posso ajudar?'
}
