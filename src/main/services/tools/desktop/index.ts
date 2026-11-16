import { shell } from 'electron'
import {
  parseConfirmOpen,
  executeDesktopIntent,
  launchAllowlistedBrowser,
  type DesktopActionResult,
  type DesktopOpener,
} from './open'
import { parseDesktopOpenIntent } from './intent'

export { parseDesktopOpenIntent, describeIntent } from './intent'
export { validateHttpsUrl, resolveOpenUrl, resolveSiteAlias } from './urls'
export {
  resolveSafePath,
  resolveFolderAlias,
  defaultPathRoots,
  isRiskyPath,
} from './paths'
export { resolveAppId, resolveAppPath, resolveBrowserAppId } from './apps'
export {
  parseConfirmOpen,
  executeDesktopIntent,
  launchAllowlistedBrowser,
  createLlmSiteResolver,
} from './open'
export type { DesktopIntent } from './intent'
export type { DesktopActionResult, DesktopOpener, ResolveSiteFn } from './open'
export {
  normalizeSiteQueryHeard,
  parseSiteResolveLlmJson,
  resolveSiteQueryDynamically,
  formatSiteOpenMessage,
} from './siteResolve'
export {
  parseDesktopInputIntent,
  executeDesktopInputIntent,
  createWindowsInputDriver,
  sanitizeTypeText,
  TYPE_TEXT_MAX_CHARS,
} from './input'
export type {
  DesktopInputIntent,
  DesktopInputDriver,
  AllowlistedKey,
} from './input'

export function electronDesktopOpener(): DesktopOpener {
  return {
    openExternal: async (url: string) => {
      await shell.openExternal(url)
    },
    openPath: async (target: string) => shell.openPath(target),
    openInBrowser: async (browserId, url) => {
      const launched = await launchAllowlistedBrowser(browserId, url)
      if (!launched.ok) return { ok: false, reason: launched.reason }
      return { ok: true }
    },
  }
}

/**
 * Tenta tratar o texto do usuário como ação de desktop.
 * Retorna null se não for intent de open (segue para o LLM).
 */
export async function tryHandleDesktopAction(
  userText: string,
  opener: DesktopOpener = electronDesktopOpener(),
): Promise<DesktopActionResult | null> {
  const confirmTarget = parseConfirmOpen(userText)
  if (confirmTarget) {
    // Reparse como open com confirmação de risky.
    const asOpen = parseDesktopOpenIntent(`abre ${confirmTarget}`)
    if (!asOpen) {
      return {
        ok: false,
        message: 'Não entendi o que confirmar. Ex.: “confirma abrir .ssh”.',
      }
    }
    return executeDesktopIntent(asOpen, opener, { confirmRisky: true })
  }

  const intent = parseDesktopOpenIntent(userText)
  if (!intent) return null

  return executeDesktopIntent(intent, opener)
}
