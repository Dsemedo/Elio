/** Helpers de mensagem de mic — sem DOM (testável no main/vitest). */

export function isMicMissingMessage(message: string | null | undefined): boolean {
  if (!message) return false
  return (
    message.includes('Nenhum microfone encontrado') ||
    message.includes('sem sinal') ||
    message.includes('mau contato')
  )
}
