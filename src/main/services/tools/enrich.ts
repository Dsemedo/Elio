import type { ChatMessage } from '../../../shared/ipc'
import { getWeatherCityPreference } from '../settings'
import { detectChatToolIntent } from './intent'
import { getLocalClock } from './time'
import { getWeatherSnapshot } from './weather'

type HistoryMessage = Pick<ChatMessage, 'role' | 'content'>

/**
 * Injeta fatos locais (hora sempre; clima sob demanda) como system message.
 * Caminho simples e confiável com llama3.2 / OpenRouter — sem tool-call loop.
 */
export async function enrichMessagesWithLocalFacts(
  messages: HistoryMessage[],
  signal?: AbortSignal,
): Promise<HistoryMessage[]> {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  const intent = detectChatToolIntent(lastUser?.content ?? '')
  const clock = getLocalClock()

  const lines = [
    'Contexto local do Elio (fatos verificados — use-os; não invente hora/clima):',
    `- Agora: ${clock.display}`,
  ]

  if (intent.needsWeather) {
    try {
      let prefs: { weatherCity?: string } | undefined
      try {
        const city = getWeatherCityPreference()
        if (city) prefs = { weatherCity: city }
      } catch {
        prefs = undefined
      }
      const weather = await getWeatherSnapshot(signal, prefs)
      // Só cidade/nome — sem lat/lon no prompt (evita vazar coords a provedores cloud).
      lines.push(`- ${weather.summary}`)
      lines.push(
        `- Fonte: Open-Meteo; cidade (${weather.location.source}): ${weather.location.name}.`,
      )
    } catch {
      lines.push(
        '- Clima: indisponível no momento (falha ao consultar Open-Meteo). Diga isso ao usuário sem inventar números.',
      )
    }
  } else if (intent.needsTime) {
    lines.push('- O usuário perguntou sobre hora/data — responda com o relógio acima.')
  }

  lines.push(
    'Responda em português do Brasil, de forma direta. Abrir sites/pastas/arquivos/apps é feito pelo Elio via allowlist (não invente que abriu algo).',
  )

  return [{ role: 'system', content: lines.join('\n') }, ...messages]
}
