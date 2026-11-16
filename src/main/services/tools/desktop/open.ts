import { access } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { describeIntent, type DesktopIntent } from './intent'
import {
  defaultPathRoots,
  resolveSafePath,
  type PathRoots,
} from './paths'
import { resolveAppPath } from './apps'
import {
  formatSiteOpenMessage,
  resolveSiteQueryDynamically,
  type SiteResolveComplete,
  type SiteResolveResult,
} from './siteResolve'
import { resolveOpenUrl } from './urls'

/**
 * Execução allowlisted: só shell.openExternal (https) e shell.openPath.
 * Sem PowerShell, sem exec arbitrário.
 * Sites desconhecidos: resolução dinâmica (LLM) + validação https — sem lista fechada.
 */

export type DesktopOpener = {
  openExternal: (url: string) => Promise<void>
  openPath: (target: string) => Promise<string>
}

export type DesktopActionResult = {
  ok: boolean
  message: string
  /** Path/URL efetivo (sem expandir home do usuário em logs externos). */
  target?: string
  requiresConfirm?: boolean
}

export type ResolveSiteFn = (
  query: string,
  signal?: AbortSignal,
) => Promise<SiteResolveResult>

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

async function openResolvedSite(
  opener: DesktopOpener,
  resolveSite: ResolveSiteFn | undefined,
  query: string,
  signal?: AbortSignal,
): Promise<DesktopActionResult> {
  if (!resolveSite) {
    return {
      ok: false,
      message: `Não conheço o site “${query}” e não há IA para resolver. Use uma URL https ou conecte OpenRouter/Ollama.`,
    }
  }
  const resolved = await resolveSite(query, signal)
  if (!resolved.ok) {
    return { ok: false, message: resolved.reason }
  }
  await opener.openExternal(resolved.url)
  return {
    ok: true,
    message: formatSiteOpenMessage(resolved),
    target: resolved.url,
  }
}

export async function executeDesktopIntent(
  intent: DesktopIntent,
  opener: DesktopOpener,
  opts?: {
    roots?: PathRoots
    platform?: NodeJS.Platform
    env?: NodeJS.ProcessEnv
    /** Se true, executa paths risky; senão pede confirmação. */
    confirmRisky?: boolean
    /** Resolve nome→https (alias + LLM). Obrigatório para open_site_query. */
    resolveSite?: ResolveSiteFn
    signal?: AbortSignal
  },
): Promise<DesktopActionResult> {
  const roots = opts?.roots ?? defaultPathRoots()
  const platform = opts?.platform ?? process.platform
  const env = opts?.env ?? process.env
  const confirmRisky = opts?.confirmRisky ?? false

  const opening = describeIntent(intent)

  try {
    switch (intent.kind) {
      case 'open_url': {
        const validated = resolveOpenUrl(intent.rawTarget)
        if (validated.ok) {
          await opener.openExternal(validated.url)
          return {
            ok: true,
            message: `${opening.replace(/…$/, '')}: ${validated.url}`,
            target: validated.url,
          }
        }
        // Nome fora da lista → resolução dinâmica (corrige STT sem o usuário).
        return openResolvedSite(
          opener,
          opts?.resolveSite,
          intent.rawTarget,
          opts?.signal,
        )
      }

      case 'open_site_query': {
        return openResolvedSite(
          opener,
          opts?.resolveSite,
          intent.query,
          opts?.signal,
        )
      }

      case 'open_folder': {
        const resolved = resolveSafePath(intent.rawTarget, roots, {
          preferRoot: 'home',
        })
        if (!resolved.ok) return { ok: false, message: resolved.reason }
        if (resolved.risky && !confirmRisky) {
          return {
            ok: false,
            requiresConfirm: true,
            message: `Pasta sensível (${intent.label}). Diga “confirma abrir ${intent.label}” para continuar.`,
            target: resolved.path,
          }
        }
        if (!(await pathExists(resolved.path))) {
          return {
            ok: false,
            message: `Pasta não encontrada: ${intent.label}`,
            target: resolved.path,
          }
        }
        const err = await opener.openPath(resolved.path)
        if (err) {
          return { ok: false, message: `Não abri a pasta: ${err}`, target: resolved.path }
        }
        return { ok: true, message: opening.replace(/…$/, '.'), target: resolved.path }
      }

      case 'open_file': {
        const resolved = resolveSafePath(intent.rawTarget, roots, {
          preferRoot: 'downloads',
        })
        if (!resolved.ok) return { ok: false, message: resolved.reason }
        if (resolved.risky && !confirmRisky) {
          return {
            ok: false,
            requiresConfirm: true,
            message: `Arquivo em local sensível (${intent.label}). Diga “confirma abrir ${intent.label}” para continuar.`,
            target: resolved.path,
          }
        }
        if (!(await pathExists(resolved.path))) {
          return {
            ok: false,
            message: `Arquivo não encontrado em pastas permitidas: ${intent.label}`,
            target: resolved.path,
          }
        }
        const err = await opener.openPath(resolved.path)
        if (err) {
          return { ok: false, message: `Não abri o arquivo: ${err}`, target: resolved.path }
        }
        return { ok: true, message: opening.replace(/…$/, '.'), target: resolved.path }
      }

      case 'open_explorer': {
        const raw = intent.rawTarget ?? roots.home
        const resolved = resolveSafePath(raw, roots, { preferRoot: 'home' })
        if (!resolved.ok) return { ok: false, message: resolved.reason }
        if (resolved.risky && !confirmRisky) {
          return {
            ok: false,
            requiresConfirm: true,
            message: `Local sensível. Diga “confirma abrir explorador em ${intent.label}” para continuar.`,
            target: resolved.path,
          }
        }
        if (!(await pathExists(resolved.path))) {
          return {
            ok: false,
            message: `Caminho não encontrado: ${intent.label}`,
            target: resolved.path,
          }
        }
        const err = await opener.openPath(resolved.path)
        if (err) {
          return { ok: false, message: `Não abri o Explorador: ${err}`, target: resolved.path }
        }
        return { ok: true, message: opening.replace(/…$/, '.'), target: resolved.path }
      }

      case 'open_app': {
        if (intent.appId === 'browser') {
          const url = 'https://www.google.com'
          await opener.openExternal(url)
          return {
            ok: true,
            message: 'Abrindo navegador.',
            target: url,
          }
        }

        if (intent.appId === 'explorer') {
          const err = await opener.openPath(roots.home)
          if (err) {
            return { ok: false, message: `Não abri o Explorador: ${err}` }
          }
          return { ok: true, message: 'Abrindo Explorador.', target: roots.home }
        }

        const appPath = resolveAppPath(intent.appId, platform, env)
        if (!appPath) {
          return {
            ok: false,
            message: `App “${intent.label}” só está na allowlist no Windows por enquanto.`,
          }
        }
        if (!(await pathExists(appPath))) {
          return {
            ok: false,
            message: `Não achei o executável de ${intent.label} neste PC.`,
            target: appPath,
          }
        }
        const err = await opener.openPath(appPath)
        if (err) {
          return { ok: false, message: `Não abri ${intent.label}: ${err}`, target: appPath }
        }
        return { ok: true, message: opening.replace(/…$/, '.'), target: appPath }
      }

      default:
        return { ok: false, message: 'Intenção de desktop desconhecida' }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Falha ao abrir'
    return { ok: false, message: msg }
  }
}

/** Detecta “confirma abrir …” para paths risky. */
export function parseConfirmOpen(text: string): string | null {
  const m = text
    .trim()
    .match(
      /^(?:confirma|confirmar|pode\s+confirmar)\s+abrir(?:\s+(?:o|a))?\s+(.+)$/i,
    )
  if (!m?.[1]) return null
  return m[1].replace(/[?.!]+$/g, '').trim()
}

/** Factory: resolveSite via routeCompletion (ou mock em testes). */
export function createLlmSiteResolver(
  complete: SiteResolveComplete,
): ResolveSiteFn {
  return (query, signal) => resolveSiteQueryDynamically(query, complete, signal)
}
