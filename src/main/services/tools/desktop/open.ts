import { access } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { describeIntent, type DesktopIntent } from './intent'
import {
  defaultPathRoots,
  resolveSafePath,
  type PathRoots,
} from './paths'
import {
  resolveAppPath,
  resolveExistingAppPath,
  type BrowserAppId,
} from './apps'
import { resolveOpenUrl } from './urls'

const execFileAsync = promisify(execFile)

/**
 * Execução allowlisted: shell.openExternal (https), shell.openPath,
 * e browser allowlisted (chrome/msedge) com URL https validada via execFile.
 * Sem PowerShell genérico / sem exec arbitrário.
 */

export type DesktopOpener = {
  openExternal: (url: string) => Promise<void>
  openPath: (target: string) => Promise<string>
  /**
   * Abre URL https num browser allowlisted (Win).
   * Em testes: mock; em produção: electronDesktopOpener.
   */
  openInBrowser?: (
    browserId: BrowserAppId,
    url: string,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>
}

export type DesktopActionResult = {
  ok: boolean
  message: string
  /** Path/URL efetivo (sem expandir home do usuário em logs externos). */
  target?: string
  requiresConfirm?: boolean
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Lança chrome.exe / msedge.exe com URL https já validada.
 * Path allowlisted + argv fixo [url] — shell:false.
 */
export async function launchAllowlistedBrowser(
  browserId: BrowserAppId,
  url: string,
  opts?: {
    platform?: NodeJS.Platform
    env?: NodeJS.ProcessEnv
  },
): Promise<{ ok: true; exe: string } | { ok: false; reason: string }> {
  const platform = opts?.platform ?? process.platform
  const env = opts?.env ?? process.env
  if (platform !== 'win32') {
    return {
      ok: false,
      reason: `Abrir no ${browserId === 'chrome' ? 'Chrome' : 'Edge'} só está disponível no Windows por enquanto.`,
    }
  }
  if (!/^https:\/\//i.test(url)) {
    return { ok: false, reason: 'Só https é permitido no browser allowlisted.' }
  }
  const exe = await resolveExistingAppPath(browserId, platform, env)
  if (!exe) {
    return {
      ok: false,
      reason: `Não achei o ${browserId === 'chrome' ? 'Chrome' : 'Edge'} neste PC.`,
    }
  }
  try {
    await execFileAsync(exe, [url], {
      windowsHide: true,
      timeout: 8_000,
      shell: false,
    })
    return { ok: true, exe }
  } catch (err) {
    const detail = err instanceof Error ? err.message.slice(0, 120) : 'erro'
    return { ok: false, reason: `Não abri o browser (${detail}).` }
  }
}

async function executeOne(
  intent: DesktopIntent,
  opener: DesktopOpener,
  opts: {
    roots: PathRoots
    platform: NodeJS.Platform
    env: NodeJS.ProcessEnv
    confirmRisky: boolean
  },
): Promise<DesktopActionResult> {
  const { roots, platform, env, confirmRisky } = opts
  const opening = describeIntent(intent)

  switch (intent.kind) {
    case 'open_many': {
      const messages: string[] = []
      let lastTarget: string | undefined
      let anyOk = false
      for (const item of intent.items) {
        if (item.kind === 'open_many') {
          messages.push('Comando composto aninhado não suportado.')
          continue
        }
        const r = await executeOne(item, opener, opts)
        messages.push(r.message)
        if (r.target) lastTarget = r.target
        if (r.ok) anyOk = true
      }
      const manyResult: DesktopActionResult = {
        ok: anyOk,
        message: messages.join(' '),
      }
      if (lastTarget !== undefined) manyResult.target = lastTarget
      return manyResult
    }

    case 'open_url': {
      const validated = resolveOpenUrl(intent.rawTarget)
      if (!validated.ok) {
        return { ok: false, message: validated.reason }
      }

      if (intent.browserId) {
        if (opener.openInBrowser) {
          const launched = await opener.openInBrowser(
            intent.browserId,
            validated.url,
          )
          if (!launched.ok) {
            // Fallback: navegador padrão do SO
            await opener.openExternal(validated.url)
            return {
              ok: true,
              message: `${launched.reason} Abri no navegador padrão: ${validated.url}`,
              target: validated.url,
            }
          }
          const browserLabel =
            intent.browserId === 'chrome' ? 'Chrome' : 'Edge'
          return {
            ok: true,
            message: `Estou abrindo ${intent.label} no ${browserLabel}: ${validated.url}`,
            target: validated.url,
          }
        }
        const launched = await launchAllowlistedBrowser(
          intent.browserId,
          validated.url,
          { platform, env },
        )
        if (!launched.ok) {
          await opener.openExternal(validated.url)
          return {
            ok: true,
            message: `${launched.reason} Abri no navegador padrão: ${validated.url}`,
            target: validated.url,
          }
        }
        const browserLabel = intent.browserId === 'chrome' ? 'Chrome' : 'Edge'
        return {
          ok: true,
          message: `Estou abrindo ${intent.label} no ${browserLabel}: ${validated.url}`,
          target: validated.url,
        }
      }

      await opener.openExternal(validated.url)
      return {
        ok: true,
        message: `${opening.replace(/…$/, '')}: ${validated.url}`,
        target: validated.url,
      }
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

      if (intent.appId === 'chrome' || intent.appId === 'edge') {
        const homeUrl = 'https://www.google.com'
        if (opener.openInBrowser) {
          const launched = await opener.openInBrowser(intent.appId, homeUrl)
          if (launched.ok) {
            return {
              ok: true,
              message: `Abrindo ${intent.label}.`,
              target: homeUrl,
            }
          }
        } else {
          const launched = await launchAllowlistedBrowser(intent.appId, homeUrl, {
            platform,
            env,
          })
          if (launched.ok) {
            return {
              ok: true,
              message: `Abrindo ${intent.label}.`,
              target: homeUrl,
            }
          }
        }
        await opener.openExternal(homeUrl)
        return {
          ok: true,
          message: `Não achei o ${intent.label}; abri no navegador padrão.`,
          target: homeUrl,
        }
      }

      if (intent.appId === 'explorer') {
        const err = await opener.openPath(roots.home)
        if (err) {
          return { ok: false, message: `Não abri o Explorador: ${err}` }
        }
        return { ok: true, message: 'Abrindo Explorador.', target: roots.home }
      }

      const appPath =
        (await resolveExistingAppPath(intent.appId, platform, env)) ??
        resolveAppPath(intent.appId, platform, env)
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
  },
): Promise<DesktopActionResult> {
  const roots = opts?.roots ?? defaultPathRoots()
  const platform = opts?.platform ?? process.platform
  const env = opts?.env ?? process.env
  const confirmRisky = opts?.confirmRisky ?? false

  try {
    return await executeOne(intent, opener, {
      roots,
      platform,
      env,
      confirmRisky,
    })
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
