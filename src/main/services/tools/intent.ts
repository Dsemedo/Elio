/**
 * Detecção leve de intenção (pt-BR) para enriquecer o prompt.
 * Sem framework de agentes — só regex generosas.
 */

export type ChatToolIntent = {
  needsTime: boolean
  needsWeather: boolean
}

const TIME_RE =
  /\b(que\s+horas|hor[aá]rio|hora\s+atual|que\s+dia|que\s+data|data\s+de\s+hoje|dia\s+de\s+hoje|hoje\s+[eé]\s+que\s+dia|me\s+diga\s+a\s+hora|qual\s+(a\s+)?hora)\b/i

const WEATHER_RE =
  /\b(tempo|clima|temperatura|chuva|chovendo|previs[aã]o|umidade|vento|faz\s+calor|faz\s+frio|como\s+est[aá]\s+o\s+tempo|como\s+est[aá]\s+o\s+clima|est[aá]\s+chovendo)\b/i

export function detectChatToolIntent(text: string): ChatToolIntent {
  const content = text.trim()
  if (!content) return { needsTime: false, needsWeather: false }
  return {
    needsTime: TIME_RE.test(content),
    needsWeather: WEATHER_RE.test(content),
  }
}
