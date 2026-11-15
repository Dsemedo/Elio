/**
 * Detecção PT-BR da lane C: aba ativa vs pesquisa web leve.
 */

export type WebContextIntent =
  | { kind: 'active_tab' }
  | {
      kind: 'web_research'
      query: string
      /** URL https explícita no pedido, se houver. */
      explicitUrl: string | null
      /** Site alias pedido (ex.: wikipedia) para montar URL pública. */
      siteHint: string | null
    }

const ACTIVE_TAB_RE =
  /\b((o\s+que|o\s+q)\s+(est[aá]|tem)\s+(n[ao]\s+)?(aba|p[aá]gina|navegador|chrome|edge|browser)|(l[eê]|ler|leia)\s+(a\s+)?(aba|p[aá]gina)(\s+(aberta|atual))?|(aba|p[aá]gina)\s+(aberta|atual)|conte[uú]do\s+da\s+(aba|p[aá]gina))\b/i

const RESEARCH_RE =
  /\b(pesquisa|pesquisar|pesquise|busca|buscar|busque|procure|procurar)\b/i

const WEB_SCOPE_RE =
  /\b(na\s+web|no\s+google|no\s+bing|na\s+internet|online|na\s+wikipedia|no\s+github|na\s+mdn)\b/i

const EXPLICIT_URL_RE = /https:\/\/[^\s<>"')\]]+/i

const SITE_HINT_RE =
  /\b(?:na|no|em)\s+(wikipedia|wiki|github|mdn|mozilla|microsoft\s+docs|electron)\b/i

function cleanQuery(raw: string): string {
  return raw
    .replace(EXPLICIT_URL_RE, ' ')
    .replace(WEB_SCOPE_RE, ' ')
    .replace(SITE_HINT_RE, ' ')
    .replace(
      /^(?:por\s+favor\s+|pf\s+|elio[,:]?\s*)?(?:pesquisa|pesquisar|pesquise|busca|buscar|busque|procure|procurar)\s+(?:por\s+|sobre\s+|acerca\s+de\s+)?/i,
      '',
    )
    .replace(/^(?:me\s+)?(?:fala|diz|conta)\s+(?:sobre\s+)?/i, '')
    .replace(/[?.!]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractSiteHint(text: string): string | null {
  const m = text.match(SITE_HINT_RE)
  if (!m?.[1]) return null
  const key = m[1].toLowerCase().replace(/\s+/g, '')
  if (key === 'wiki' || key === 'wikipedia') return 'wikipedia'
  if (key === 'github') return 'github'
  if (key === 'mdn' || key === 'mozilla') return 'mdn'
  if (key === 'microsoftdocs') return 'msdocs'
  if (key === 'electron') return 'electron'
  return null
}

/**
 * Classifica pedidos de contexto web. Null = não é lane C.
 */
export function parseWebContextIntent(text: string): WebContextIntent | null {
  const content = text.trim()
  if (!content) return null

  if (ACTIVE_TAB_RE.test(content)) {
    return { kind: 'active_tab' }
  }

  const hasResearchVerb = RESEARCH_RE.test(content)
  const hasWebScope = WEB_SCOPE_RE.test(content)
  const urlMatch = content.match(EXPLICIT_URL_RE)

  // "pesquisa na web sobre X" / "busca no google Y" / URL https + pedido de ler/resumir
  const wantsReadUrl =
    !!urlMatch &&
    /\b(l[eê]|ler|leia|resume|resumir|resumo|abre\s+e\s+l[eê]|o\s+que\s+diz)\b/i.test(
      content,
    )

  if (!hasResearchVerb && !wantsReadUrl) {
    // "pesquisa web" curto sem verbo separado
    if (!/\bpesquisa\s+(na\s+)?web\b/i.test(content)) return null
  }

  if (hasResearchVerb && !hasWebScope && !urlMatch && !wantsReadUrl) {
    // "pesquisa sobre X" sem escopo web — ainda aceitamos como research leve
    // se parecer pergunta factual (evita "pesquisa de satisfação" etc. depois).
    if (!/\b(sobre|acerca|por)\b/i.test(content) && !WEB_SCOPE_RE.test(content)) {
      return null
    }
  }

  if (!hasResearchVerb && !wantsReadUrl && !/\bpesquisa\s+(na\s+)?web\b/i.test(content)) {
    return null
  }

  const siteHint = extractSiteHint(content)
  const query = cleanQuery(content)
  if (!query && !urlMatch) return null

  return {
    kind: 'web_research',
    query: query || (urlMatch ? urlMatch[0] : ''),
    explicitUrl: urlMatch ? urlMatch[0].replace(/[.,;:!?)]+$/, '') : null,
    siteHint,
  }
}
