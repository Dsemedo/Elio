import { describe, expect, it, vi } from 'vitest'
import {
  isBlockedPrivateHostname,
  isFetchAllowlistedHost,
  parseWebContextIntent,
  fetchPublicPageText,
  runWebResearch,
  getActiveBrowserTab,
  formatActiveTabUnavailable,
} from '../src/main/services/tools/web'
import { classifyUserIntent, laneLabel } from '../src/main/services/tools/router'

describe('parseWebContextIntent', () => {
  it('detecta aba ativa', () => {
    expect(parseWebContextIntent('o que está na aba aberta?')).toEqual({
      kind: 'active_tab',
    })
    expect(parseWebContextIntent('lê a página atual')).toEqual({
      kind: 'active_tab',
    })
  })

  it('detecta pesquisa web com query', () => {
    const r = parseWebContextIntent('pesquisa na web sobre inteligência artificial')
    expect(r?.kind).toBe('web_research')
    if (r?.kind === 'web_research') {
      expect(r.query.toLowerCase()).toContain('intelig')
      expect(r.explicitUrl).toBeNull()
    }
  })

  it('captura URL https explícita e site hint', () => {
    const r = parseWebContextIntent(
      'resume https://pt.wikipedia.org/wiki/Electron na wikipedia',
    )
    expect(r?.kind).toBe('web_research')
    if (r?.kind === 'web_research') {
      expect(r.explicitUrl).toContain('wikipedia.org')
      expect(r.siteHint).toBe('wikipedia')
    }
  })

  it('ignora conversa geral', () => {
    expect(parseWebContextIntent('olá, tudo bem?')).toBeNull()
    expect(parseWebContextIntent('me explique o que é um ADR')).toBeNull()
  })
})

describe('fetch allowlist / SSRF basics', () => {
  it('permite hosts públicos conhecidos', () => {
    expect(isFetchAllowlistedHost('pt.wikipedia.org')).toBe(true)
    expect(isFetchAllowlistedHost('developer.mozilla.org')).toBe(true)
    expect(isFetchAllowlistedHost('evil.example')).toBe(false)
    expect(isFetchAllowlistedHost('127.0.0.1')).toBe(false)
  })

  it('bloqueia privados', () => {
    expect(isBlockedPrivateHostname('localhost')).toBe(true)
    expect(isBlockedPrivateHostname('192.168.0.1')).toBe(true)
    expect(isBlockedPrivateHostname('10.0.0.5')).toBe(true)
    expect(isBlockedPrivateHostname('pt.wikipedia.org')).toBe(false)
  })

  it('recusa fetch fora da allowlist', async () => {
    const r = await fetchPublicPageText('https://evil.example/page')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/allowlist/i)
  })

  it('recusa http e hosts privados', async () => {
    expect((await fetchPublicPageText('http://pt.wikipedia.org/wiki/X')).ok).toBe(
      false,
    )
    expect((await fetchPublicPageText('https://127.0.0.1/')).ok).toBe(false)
  })
})

describe('runWebResearch', () => {
  it('abre busca Google e não faz crawl da SERP', async () => {
    const openExternal = vi.fn(async () => undefined)
    const result = await runWebResearch(
      {
        kind: 'web_research',
        query: 'Elio assistente',
        explicitUrl: null,
        siteHint: null,
      },
      { openExternal },
    )
    expect(result.ok).toBe(true)
    expect(openExternal).toHaveBeenCalledOnce()
    expect(result.openedUrl?.startsWith('https://www.google.com/search?')).toBe(
      true,
    )
    expect(result.retrievedForLlm).toBeUndefined()
    expect(result.message).toMatch(/allowlist|Abri/i)
  })

  it('tenta fetch quando há URL allowlisted', async () => {
    const openExternal = vi.fn(async () => undefined)
    const html =
      '<html><head><title>Teste</title></head><body><p>Conteudo publico de teste.</p></body></html>'
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(html, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    )

    const result = await runWebResearch(
      {
        kind: 'web_research',
        query: 'Electron',
        explicitUrl: 'https://pt.wikipedia.org/wiki/Electron',
        siteHint: 'wikipedia',
      },
      { openExternal },
    )

    expect(result.ok).toBe(true)
    expect(openExternal).toHaveBeenCalled()
    expect(result.fetched?.ok).toBe(true)
    expect(result.retrievedForLlm).toMatch(/NÃO CONFIÁVEL/)
    expect(result.retrievedForLlm).toMatch(/Conteudo publico/)

    fetchMock.mockRestore()
  })
})

describe('active tab sem extensão', () => {
  it('retorna status honesto', async () => {
    const tab = await getActiveBrowserTab()
    expect(tab.available).toBe(false)
    if (!tab.available) {
      expect(tab.code).toBe('extension_missing')
      expect(formatActiveTabUnavailable(tab)).toMatch(/extensão/i)
    }
  })
})

describe('classifyUserIntent — lane C atualizada', () => {
  it('C active_tab', () => {
    const tab = classifyUserIntent('o que está na aba aberta?')
    expect(tab.lane).toBe('web_context')
    if (tab.lane === 'web_context') {
      expect(tab.web.kind).toBe('active_tab')
    }
  })

  it('C web_research', () => {
    const research = classifyUserIntent('pesquisa na web sobre Elio')
    expect(research.lane).toBe('web_context')
    if (research.lane === 'web_context') {
      expect(research.web.kind).toBe('web_research')
    }
  })

  it('label sem “em breve”', () => {
    expect(laneLabel('web_context')).toBe('Contexto web')
  })
})
