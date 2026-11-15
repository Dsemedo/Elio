/** Helpers de mensagem de mic — sem DOM (testável no main/vitest). */

export function isMicMissingMessage(message: string | null | undefined): boolean {
  if (!message) return false
  return (
    message.includes('Nenhum microfone encontrado') ||
    message.includes('sem sinal') ||
    message.includes('mau contato')
  )
}

/** Chip PT-BR quando o SO já bloqueou o mic (sem tentar Whisper). */
export function micAccessDeniedUserMessage(): string {
  return 'Microfone bloqueado no Windows — Privacidade → Microfone (apps de desktop / Elio)'
}
