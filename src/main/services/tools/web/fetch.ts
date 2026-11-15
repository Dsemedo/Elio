/**
 * Fetch de uma única página HTTPS pública (allowlist) → texto plano truncado.
 * Sem crawler, sem seguir links, sem POST.
 */

import {
  isBlockedPrivateHostname,
  isFetchAllowlistedHost,
} from './allowlist'

const FETCH_TIMEOUT_MS = 8_000
const MAX_BYTES = 512_000
const MAX_TEXT_CHARS = 6_000
const USER_AGENT = 'ElioAssistant/0.15 (+https://github.com/Dsemedo/Elio; research-mvp)'

export type PublicPageFetchResult =
  | {
      ok: true
      url: string
      finalUrl: string
      title: string | null
      text: string
      truncated: boolean
    }
  | { ok: false; reason: string }

function htmlToText(html: string): { title: string | null; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch?.[1]
    ? titleMatch[1].replace(/\s+/g, ' ').trim().slice(0, 200)
    : null

  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')

  const text = withoutScripts
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  return { title, text }
}

function validateFetchUrl(raw: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { ok: false, reason: 'URL inválida' }
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Só https é permitido para leitura de página' }
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'URL com credenciais não é permitida' }
  }
  if (!parsed.hostname) {
    return { ok: false, reason: 'Host inválido' }
  }
  if (isBlockedPrivateHostname(parsed.hostname)) {
    return { ok: false, reason: 'Host privado/local bloqueado' }
  }
  if (!isFetchAllowlistedHost(parsed.hostname)) {
    return {
      ok: false,
      reason: `Host “${parsed.hostname}” fora da allowlist de leitura. Posso só abrir a URL no navegador se for https.`,
    }
  }

  return { ok: true, url: parsed }
}

/**
 * Baixa o HTML de uma URL allowlisted e extrai texto.
 * Redirects: só segue se o destino continuar https + allowlist.
 */
export async function fetchPublicPageText(
  rawUrl: string,
  signal?: AbortSignal,
): Promise<PublicPageFetchResult> {
  const validated = validateFetchUrl(rawUrl)
  if (!validated.ok) return validated

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  const onAbort = (): void => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })

  try {
    const response = await fetch(validated.url.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8,*/*;q=0.1',
        'User-Agent': USER_AGENT,
      },
    })

    // Segue no máximo 1 redirect manual (e revalida allowlist).
    let finalResponse = response
    let finalUrl = validated.url.toString()
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      if (!location) {
        return { ok: false, reason: 'Redirect sem Location' }
      }
      const next = new URL(location, validated.url)
      const nextValidated = validateFetchUrl(next.toString())
      if (!nextValidated.ok) {
        return {
          ok: false,
          reason: `Redirect bloqueado: ${nextValidated.reason}`,
        }
      }
      finalResponse = await fetch(nextValidated.url.toString(), {
        method: 'GET',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8,*/*;q=0.1',
          'User-Agent': USER_AGENT,
        },
      })
      finalUrl = nextValidated.url.toString()
    }

    if (!finalResponse.ok) {
      return {
        ok: false,
        reason: `HTTP ${finalResponse.status} ao ler a página`,
      }
    }

    const contentType = (finalResponse.headers.get('content-type') ?? '').toLowerCase()
    if (
      contentType &&
      !contentType.includes('text/') &&
      !contentType.includes('html') &&
      !contentType.includes('xml') &&
      !contentType.includes('json')
    ) {
      return { ok: false, reason: `Tipo de conteúdo não suportado: ${contentType}` }
    }

    const buf = new Uint8Array(await finalResponse.arrayBuffer())
    if (buf.byteLength > MAX_BYTES) {
      return {
        ok: false,
        reason: `Página maior que o limite (${MAX_BYTES} bytes)`,
      }
    }

    const html = new TextDecoder('utf-8', { fatal: false }).decode(buf)
    const { title, text: fullText } = htmlToText(html)
    const truncated = fullText.length > MAX_TEXT_CHARS
    const text = truncated ? fullText.slice(0, MAX_TEXT_CHARS) : fullText

    if (!text) {
      return { ok: false, reason: 'Não encontrei texto legível na página' }
    }

    return {
      ok: true,
      url: validated.url.toString(),
      finalUrl,
      title,
      text,
      truncated,
    }
  } catch (err) {
    if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
      return { ok: false, reason: 'Leitura da página cancelada ou expirou' }
    }
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'Falha ao ler a página',
    }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

export { validateFetchUrl }
