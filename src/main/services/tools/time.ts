/** Fuso padrão do produto (Douglas / BR). Sobrescreva com ELIO_TIMEZONE. */
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo'

export type LocalClock = {
  timezone: string
  /** ISO 8601 com offset local do fuso. */
  iso: string
  /** Texto curto em pt-BR para o modelo. */
  display: string
  weekday: string
  date: string
  time: string
}

function resolveTimezone(): string {
  const fromEnv = process.env['ELIO_TIMEZONE']?.trim()
  if (fromEnv) return fromEnv
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE
  } catch {
    return DEFAULT_TIMEZONE
  }
}

/**
 * Relógio local tipado — sem rede, sem privilégios.
 * Preferência: ELIO_TIMEZONE → fuso do SO → America/Sao_Paulo.
 */
export function getLocalClock(now: Date = new Date()): LocalClock {
  const timezone = resolveTimezone()
  const weekday = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    weekday: 'long',
  }).format(now)
  const date = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(now)
  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now)
  const iso = new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
    .format(now)
    .replace(' ', 'T')

  return {
    timezone,
    iso,
    weekday,
    date,
    time,
    display: `${weekday}, ${date}, ${time} (${timezone})`,
  }
}

/** Resposta determinística de hora (sem LLM) — Fatia 1 do loop demo. */
export function formatClockUserReply(clock: LocalClock = getLocalClock()): string {
  const hhmm = clock.time.slice(0, 5)
  return `Agora são ${hhmm} — ${clock.weekday}, ${clock.date} (${clock.timezone}).`
}
