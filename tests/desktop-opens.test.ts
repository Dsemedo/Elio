import { describe, expect, it } from 'vitest'
import { parseDesktopOpenIntent, describeIntent } from '../src/main/services/tools/desktop/intent'
import {
  validateHttpsUrl,
  resolveOpenUrl,
  resolveSiteAlias,
} from '../src/main/services/tools/desktop/urls'
import {
  defaultPathRoots,
  resolveFolderAlias,
  resolveSafePath,
  isRiskyPath,
} from '../src/main/services/tools/desktop/paths'
import { resolveAppId, resolveAppPath } from '../src/main/services/tools/desktop/apps'
import {
  executeDesktopIntent,
  parseConfirmOpen,
  type DesktopOpener,
} from '../src/main/services/tools/desktop/open'
import { join, resolve } from 'node:path'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'

describe('validateHttpsUrl / resolveOpenUrl', () => {
  it('aceita só https', () => {
    expect(validateHttpsUrl('https://www.exame.com').ok).toBe(true)
    expect(validateHttpsUrl('http://exame.com').ok).toBe(false)
    expect(validateHttpsUrl('javascript:alert(1)').ok).toBe(false)
    expect(validateHttpsUrl('file:///C:/Windows').ok).toBe(false)
  })

  it('rejeita credenciais na URL', () => {
    const r = validateHttpsUrl('https://user:pass@evil.example/')
    expect(r.ok).toBe(false)
  })

  it('resolve aliases PT-BR', () => {
    expect(resolveSiteAlias('Exame')).toBe('https://www.exame.com')
    expect(resolveSiteAlias('google')).toBe('https://www.google.com')
    const alias = resolveOpenUrl('exame')
    expect(alias.ok).toBe(true)
    if (alias.ok) {
      expect(alias.url).toContain('exame.com')
    }
  })

  it('promove www. sem esquema para https', () => {
    const r = resolveOpenUrl('www.google.com')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.url.startsWith('https://')).toBe(true)
  })
})

describe('resolveSafePath / allowlist', () => {
  const home = join(tmpdir(), 'elio-desktop-test-home')
  const roots = defaultPathRoots(home)

  it('resolve aliases de pasta comuns', () => {
    expect(resolveFolderAlias('Downloads', roots)).toBe(roots.downloads)
    expect(resolveFolderAlias('documentos', roots)).toBe(roots.documents)
    expect(resolveFolderAlias('área de trabalho', roots)).toBe(roots.desktop)
  })

  it('bloqueia escape com .. fora de home', () => {
    const r = resolveSafePath('../../../Windows/System32', roots)
    expect(r.ok).toBe(false)
  })

  it('bloqueia absoluto fora das raízes', () => {
    const outside = resolve(home, '..', 'elio-forbidden-outside')
    const r = resolveSafePath(outside, roots)
    expect(r.ok).toBe(false)
  })

  it('aceita path sob Downloads', () => {
    const r = resolveSafePath('relatorio.pdf', roots, { preferRoot: 'downloads' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.path.toLowerCase()).toContain('downloads')
      expect(r.path.endsWith('relatorio.pdf')).toBe(true)
    }
  })

  it('marca .ssh como risky', () => {
    const ssh = join(roots.home, '.ssh', 'id_rsa')
    expect(isRiskyPath(ssh, roots)).toBe(true)
  })
})

describe('parseDesktopOpenIntent (PT-BR)', () => {
  it('detecta abrir site', () => {
    const a = parseDesktopOpenIntent('abre o site da Exame')
    expect(a?.kind).toBe('open_url')
    if (a?.kind === 'open_url') expect(a.rawTarget.toLowerCase()).toContain('exame')

    const b = parseDesktopOpenIntent('abrir o google')
    expect(b?.kind).toBe('open_url')
  })

  it('detecta pasta Downloads', () => {
    const a = parseDesktopOpenIntent('abre a pasta Downloads')
    expect(a?.kind).toBe('open_folder')
    if (a?.kind === 'open_folder') expect(a.rawTarget.toLowerCase()).toContain('download')
  })

  it('detecta arquivo', () => {
    const a = parseDesktopOpenIntent('abre o arquivo notas.txt')
    expect(a?.kind).toBe('open_file')
    if (a?.kind === 'open_file') expect(a.rawTarget).toContain('notas.txt')
  })

  it('detecta explorador e apps', () => {
    expect(parseDesktopOpenIntent('abre o explorador em Downloads')?.kind).toBe(
      'open_explorer',
    )
    expect(parseDesktopOpenIntent('abre a calculadora')?.kind).toBe('open_app')
    expect(parseDesktopOpenIntent('abre o bloco de notas')?.kind).toBe('open_app')
  })

  it('não captura conversa normal', () => {
    expect(parseDesktopOpenIntent('olá, tudo bem?')).toBeNull()
    expect(parseDesktopOpenIntent('que horas são?')).toBeNull()
    expect(parseDesktopOpenIntent('abre a conversa comigo sobre clima')).toBeNull()
  })

  it('describeIntent em PT', () => {
    const intent = parseDesktopOpenIntent('abre a pasta Downloads')
    expect(intent).not.toBeNull()
    if (intent) {
      expect(describeIntent(intent)).toMatch(/Abrindo pasta/i)
    }
  })
})

describe('apps allowlist', () => {
  it('resolve ids conhecidos', () => {
    expect(resolveAppId('calculadora')).toBe('calculator')
    expect(resolveAppId('bloco de notas')).toBe('notepad')
  })

  it('paths fixos só no win32', () => {
    expect(resolveAppPath('notepad', 'linux')).toBeNull()
    expect(resolveAppPath('notepad', 'win32')?.toLowerCase()).toContain('notepad.exe')
  })
})

describe('executeDesktopIntent', () => {
  it('abre https via openExternal', async () => {
    const opened: string[] = []
    const opener: DesktopOpener = {
      openExternal: async (url) => {
        opened.push(url)
      },
      openPath: async () => '',
    }
    const intent = parseDesktopOpenIntent('abre o site da Exame')
    expect(intent).not.toBeNull()
    if (!intent) return
    const result = await executeDesktopIntent(intent, opener)
    expect(result.ok).toBe(true)
    expect(opened[0]).toMatch(/^https:\/\//)
  })

  it('abre pasta real sob home de teste', async () => {
    const home = join(tmpdir(), `elio-open-${Date.now()}`)
    const roots = defaultPathRoots(home)
    await mkdir(roots.downloads, { recursive: true })
    const opened: string[] = []
    const opener: DesktopOpener = {
      openExternal: async () => undefined,
      openPath: async (p) => {
        opened.push(p)
        return ''
      },
    }
    try {
      const intent = parseDesktopOpenIntent('abre a pasta Downloads')
      expect(intent).not.toBeNull()
      if (!intent) return
      const result = await executeDesktopIntent(intent, opener, { roots })
      expect(result.ok).toBe(true)
      expect(opened[0]).toBe(roots.downloads)
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('pede confirmação para path risky', async () => {
    const home = join(tmpdir(), `elio-risky-${Date.now()}`)
    const roots = defaultPathRoots(home)
    const sshDir = join(home, '.ssh')
    const sshFile = join(sshDir, 'id_rsa')
    await mkdir(sshDir, { recursive: true })
    await writeFile(sshFile, 'x')
    const opener: DesktopOpener = {
      openExternal: async () => undefined,
      openPath: async () => '',
    }
    try {
      const intent = {
        kind: 'open_file' as const,
        label: '.ssh/id_rsa',
        rawTarget: sshFile,
      }
      const denied = await executeDesktopIntent(intent, opener, { roots })
      expect(denied.ok).toBe(false)
      expect(denied.requiresConfirm).toBe(true)

      const confirmed = await executeDesktopIntent(intent, opener, {
        roots,
        confirmRisky: true,
      })
      expect(confirmed.ok).toBe(true)
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('parseConfirmOpen', () => {
    expect(parseConfirmOpen('confirma abrir .ssh')).toBe('.ssh')
    expect(parseConfirmOpen('olá')).toBeNull()
  })
})
