/**
 * Validação de URLs para shell.openExternal — só https.
 * Aliases PT-BR de sites comuns (sem inventar HTTP).
 */

const SITE_ALIASES: Record<string, string> = {
  exame: 'https://www.exame.com',
  google: 'https://www.google.com',
  googlemaps: 'https://www.google.com/maps',
  maps: 'https://www.google.com/maps',
  mapagoogle: 'https://www.google.com/maps',
  youtube: 'https://www.youtube.com',
  gmail: 'https://mail.google.com',
  github: 'https://github.com',
  linkedin: 'https://www.linkedin.com',
  twitter: 'https://x.com',
  x: 'https://x.com',
  whatsapp: 'https://web.whatsapp.com',
  notion: 'https://www.notion.so',
  outlook: 'https://outlook.live.com',
  bing: 'https://www.bing.com',
  wikipedia: 'https://pt.wikipedia.org',
  facebook: 'https://www.facebook.com',
  instagram: 'https://www.instagram.com',
  reddit: 'https://www.reddit.com',
  netflix: 'https://www.netflix.com',
  spotify: 'https://open.spotify.com',
  chatgpt: 'https://chatgpt.com',
}

/** Normaliza rótulo de site: minúsculas, sem acento, só [a-z0-9]. */
export function normalizeSiteKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

export function resolveSiteAlias(name: string): string | null {
  const key = normalizeSiteKey(name)
  if (!key) return null
  return SITE_ALIASES[key] ?? null
}

export type UrlValidation =
  | { ok: true; url: string }
  | { ok: false; reason: string }

/**
 * Aceita só https absolutos. Rejeita javascript:, file:, http:, etc.
 */
export function validateHttpsUrl(raw: string): UrlValidation {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ok: false, reason: 'URL vazia' }
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    // Sem esquema: tenta como hostname → https
    try {
      parsed = new URL(`https://${trimmed}`)
    } catch {
      return { ok: false, reason: 'URL inválida' }
    }
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Só https é permitido' }
  }

  if (!parsed.hostname || parsed.hostname.includes(' ')) {
    return { ok: false, reason: 'Host inválido' }
  }

  // Bloqueia credenciais embutidas e userinfo estranho.
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'URL com credenciais não é permitida' }
  }

  return { ok: true, url: parsed.toString() }
}

/**
 * Resolve texto livre ("exame", "https://exame.com", "www.google.com") → https.
 */
export function resolveOpenUrl(raw: string): UrlValidation {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, reason: 'Site vazio' }

  if (/^https?:\/\//i.test(trimmed) || trimmed.includes('.')) {
    return validateHttpsUrl(trimmed)
  }

  const alias = resolveSiteAlias(trimmed)
  if (alias) return { ok: true, url: alias }

  return {
    ok: false,
    reason: `Não conheço o site “${trimmed}”. Use uma URL https ou um nome conhecido (Exame, Google…).`,
  }
}

export function listKnownSites(): string[] {
  return Object.keys(SITE_ALIASES).sort()
}
