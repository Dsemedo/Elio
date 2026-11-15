/**
 * Hosts permitidos para *fetch* de texto público (pesquisa leve).
 * Mais restrito que openExternal: só fontes públicas conhecidas.
 * Sem crawl — uma URL por pedido.
 */

/** Hosts exatos ou sufixos (ex.: wikipedia.org cobre pt.wikipedia.org). */
const FETCH_HOST_SUFFIXES = [
  'wikipedia.org',
  'wikimedia.org',
  'github.com',
  'githubusercontent.com',
  'docs.github.com',
  'developer.mozilla.org',
  'mdn.io',
  'learn.microsoft.com',
  'docs.microsoft.com',
  'nodejs.org',
  'electronjs.org',
  'open-meteo.com',
  'pt.wikipedia.org',
  'en.wikipedia.org',
] as const

export function isFetchAllowlistedHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '')
  if (!host || host.includes(':') || host === 'localhost') return false

  // Bloqueia literais IP (SSRF básico) — só hostnames DNS na allowlist.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false
  if (host.includes(':')) return false // IPv6

  return FETCH_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  )
}

export function listFetchAllowlistHosts(): string[] {
  return [...FETCH_HOST_SUFFIXES].sort()
}

/**
 * Bloqueia hosts privados/link-local mesmo se alguém burlar a lista.
 * (Defesa em profundidade; allowlist já exclui IPs.)
 */
export function isBlockedPrivateHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase()
  if (
    host === 'localhost' ||
    host === 'metadata.google.internal' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const parts = host.split('.').map(Number)
    const a = parts[0] ?? -1
    const b = parts[1] ?? -1
    if (a === 10) return true
    if (a === 127) return true
    if (a === 0) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  }
  return false
}
