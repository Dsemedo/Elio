import { resolveAppId, type AppId } from './apps'
import { resolveFolderAlias, normalizeFolderKey } from './paths'
import { resolveSiteAlias } from './urls'

/**
 * Parsing leve de intenções PT-BR para abrir site / pasta / arquivo / app.
 * Sem framework de agentes — regex + allowlist.
 */

export type DesktopIntent =
  | { kind: 'open_url'; label: string; rawTarget: string }
  /** Nome livre (jornal, portal…) — resolve URL dinamicamente + corrige STT. */
  | { kind: 'open_site_query'; label: string; query: string }
  | { kind: 'open_folder'; label: string; rawTarget: string }
  | { kind: 'open_file'; label: string; rawTarget: string }
  | { kind: 'open_app'; label: string; appId: AppId }
  | { kind: 'open_explorer'; label: string; rawTarget: string | null }

/** Pedidos que parecem conversa, não “abrir site/arquivo”. */
const NON_SITE_OPEN_RE =
  /\b(conversa|assunto|discuss[aã]o|papo|hist[oó]rico|cap[ií]tulo|ideia|explica|me\s+fala|sobre\s+mim)\b/i

const OPEN_VERB =
  /^(?:por\s+favor\s+|pf\s+|pode\s+)?(?:abre|abrir|abra|abre\s+a[ií])\b[\s,]*/i

function stripOpenVerb(text: string): string | null {
  const trimmed = text.trim()
  if (!OPEN_VERB.test(trimmed)) return null
  return trimmed.replace(OPEN_VERB, '').trim()
}

function cleanTarget(raw: string): string {
  return raw
    .trim()
    .replace(/^(o|a|os|as|um|uma)\s+/i, '')
    .replace(/[?.!]+$/g, '')
    .trim()
}

/**
 * Detecta intenção de abrir. Retorna null se não for comando de open claro.
 */
export function parseDesktopOpenIntent(text: string): DesktopIntent | null {
  const rest = stripOpenVerb(text)
  if (rest === null) return null
  if (!rest) return null

  // URL explícita
  if (/^https:\/\//i.test(rest) || /^www\./i.test(rest)) {
    return { kind: 'open_url', label: rest, rawTarget: rest }
  }

  // "o site da Exame" / "site exame" / "o site https://..." / "site do jornal …"
  const siteMatch = rest.match(
    /^(?:o\s+)?site\s+(?:da|do|de|d[aeo])?\s*(.+)$/i,
  )
  if (siteMatch?.[1]) {
    const target = cleanTarget(siteMatch[1])
    if (resolveSiteAlias(target) || /^https:\/\//i.test(target) || /\./.test(target)) {
      return { kind: 'open_url', label: target, rawTarget: target }
    }
    return { kind: 'open_site_query', label: target, query: target }
  }

  // "o jornal …" / "a revista …" / "o portal …" — quase sempre site; resolve dinâmico.
  const publicationMatch = rest.match(
    /^(?:o\s+|a\s+)?(jornal|revista|portal|blog)\s+(.+)$/i,
  )
  if (publicationMatch?.[2] && !NON_SITE_OPEN_RE.test(rest)) {
    const kind = publicationMatch[1] ?? 'jornal'
    const name = cleanTarget(publicationMatch[2])
    const query = `${kind} ${name}`.replace(/\s+/g, ' ').trim()
    return { kind: 'open_site_query', label: query, query }
  }

  // "navegador/browser em/no/na X" ou "navegador"
  const browserMatch = rest.match(
    /^(?:o\s+)?(?:navegador|browser)(?:\s+(?:em|na|no|para|com)\s+(.+))?$/i,
  )
  if (browserMatch) {
    if (browserMatch[1]) {
      const target = cleanTarget(browserMatch[1])
      return { kind: 'open_url', label: target, rawTarget: target }
    }
    return { kind: 'open_app', label: 'navegador', appId: 'browser' }
  }

  // "a pasta Downloads" / "pasta Documentos"
  const folderMatch = rest.match(/^(?:a\s+)?pasta\s+(.+)$/i)
  if (folderMatch?.[1]) {
    const target = cleanTarget(folderMatch[1])
    return { kind: 'open_folder', label: target, rawTarget: target }
  }

  // "o arquivo X" / "arquivo X"
  const fileMatch = rest.match(/^(?:o\s+)?arquivo\s+(.+)$/i)
  if (fileMatch?.[1]) {
    const target = cleanTarget(fileMatch[1])
    return { kind: 'open_file', label: target, rawTarget: target }
  }

  // "o explorador em Downloads" / "explorador de arquivos" / "file explorer"
  const explorerMatch = rest.match(
    /^(?:o\s+)?(?:explorador(?:\s+de\s+arquivos)?|file\s*explorer|explorer)(?:\s+(?:em|na|no|para)\s+(.+))?$/i,
  )
  if (explorerMatch) {
    const target = explorerMatch[1] ? cleanTarget(explorerMatch[1]) : null
    return {
      kind: 'open_explorer',
      label: target ?? 'Explorador',
      rawTarget: target,
    }
  }

  // App conhecido: "o bloco de notas", "calculadora"
  const appCandidate = cleanTarget(rest)
  const appId = resolveAppId(appCandidate)
  if (appId) {
    return { kind: 'open_app', label: appCandidate, appId }
  }

  // Pasta conhecida sem a palavra "pasta": "abre Downloads"
  if (resolveFolderAlias(appCandidate)) {
    return {
      kind: 'open_folder',
      label: appCandidate,
      rawTarget: appCandidate,
    }
  }

  // Site conhecido sem a palavra "site": "abre a Exame" / "abre o Google"
  if (resolveSiteAlias(appCandidate)) {
    return { kind: 'open_url', label: appCandidate, rawTarget: appCandidate }
  }

  // "a Exame" / "o Google" — artigo + nome
  const articleSite = rest.match(/^(?:a|o)\s+([A-Za-zÀ-ÿ0-9][\wÀ-ÿ.-]*)$/i)
  if (articleSite?.[1] && resolveSiteAlias(articleSite[1])) {
    const target = cleanTarget(articleSite[1])
    return { kind: 'open_url', label: target, rawTarget: target }
  }

  // Caminho absoluto Windows / relativo com extensão → arquivo
  if (
    /^[a-zA-Z]:[\\/]/.test(rest) ||
    rest.includes('\\') ||
    /\.\w{1,8}$/.test(rest)
  ) {
    const target = cleanTarget(rest)
    return { kind: 'open_file', label: target, rawTarget: target }
  }

  // Hostname solto: "abre opopular.com.br"
  if (normalizeFolderKey(rest).length > 0) {
    if (/\./.test(rest) && !/\s/.test(rest)) {
      return { kind: 'open_url', label: rest, rawTarget: cleanTarget(rest) }
    }
  }

  // Nome livre após "abre …" → resolução dinâmica (sem lista fechada).
  // Evita "abre a conversa…" / frases vagas virarem open.
  if (!NON_SITE_OPEN_RE.test(rest)) {
    const query = cleanTarget(rest)
    if (query.length >= 2 && /[a-zA-ZÀ-ÿ]/.test(query)) {
      return { kind: 'open_site_query', label: query, query }
    }
  }

  return null
}

export function describeIntent(intent: DesktopIntent): string {
  switch (intent.kind) {
    case 'open_url':
      return `Abrindo site ${intent.label}…`
    case 'open_site_query':
      return `Abrindo ${intent.label}…`
    case 'open_folder':
      return `Abrindo pasta ${intent.label}…`
    case 'open_file':
      return `Abrindo arquivo ${intent.label}…`
    case 'open_app':
      return `Abrindo ${intent.label}…`
    case 'open_explorer':
      return intent.rawTarget
        ? `Abrindo Explorador em ${intent.label}…`
        : 'Abrindo Explorador…'
  }
}
