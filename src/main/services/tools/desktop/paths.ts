import { homedir } from 'node:os'
import {
  basename,
  isAbsolute,
  join,
  normalize,
  resolve,
  sep,
} from 'node:path'

/**
 * Allowlist de pastas: home + dirs comuns.
 * Rejeita `..` que saia das raízes permitidas. Sem delete/move/write.
 */

export type PathRoots = {
  home: string
  desktop: string
  downloads: string
  documents: string
  pictures: string
  music: string
  videos: string
}

const FOLDER_ALIASES: Record<string, keyof PathRoots> = {
  home: 'home',
  casa: 'home',
  usuario: 'home',
  user: 'home',
  desktop: 'desktop',
  areadetrabalho: 'desktop',
  area: 'desktop',
  downloads: 'downloads',
  download: 'downloads',
  baixados: 'downloads',
  documentos: 'documents',
  documents: 'documents',
  docs: 'documents',
  imagens: 'pictures',
  pictures: 'pictures',
  fotos: 'pictures',
  musicas: 'music',
  music: 'music',
  videos: 'videos',
}

/** Normaliza rótulo de pasta (sem acento, minúsculo). */
export function normalizeFolderKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

export function defaultPathRoots(home = homedir()): PathRoots {
  return {
    home,
    desktop: join(home, 'Desktop'),
    downloads: join(home, 'Downloads'),
    documents: join(home, 'Documents'),
    pictures: join(home, 'Pictures'),
    music: join(home, 'Music'),
    videos: join(home, 'Videos'),
  }
}

/** Também aceita nomes PT do Windows (Área de Trabalho, Documentos…). */
export function resolveFolderAlias(
  raw: string,
  roots: PathRoots = defaultPathRoots(),
): string | null {
  const key = normalizeFolderKey(raw)
  if (!key) return null

  // "areadetrabalho" etc.
  const mapped = FOLDER_ALIASES[key]
  if (mapped) return roots[mapped]

  // Match direto pelo basename da raiz (Desktop, Downloads…).
  for (const value of Object.values(roots)) {
    if (normalizeFolderKey(basename(value)) === key) return value
  }

  // PT Windows comuns sob home
  const ptGuess: Record<string, string> = {
    areadetrabalho: join(roots.home, 'Área de Trabalho'),
    documentos: join(roots.home, 'Documentos'),
    imagens: join(roots.home, 'Imagens'),
    musicas: join(roots.home, 'Músicas'),
    videos: join(roots.home, 'Vídeos'),
  }
  if (ptGuess[key]) return ptGuess[key]

  return null
}

export type SafePathResult =
  | { ok: true; path: string; risky: boolean }
  | { ok: false; reason: string }

function isPathInside(child: string, parent: string): boolean {
  const rel = normalize(child).toLowerCase()
  const base = normalize(parent).toLowerCase()
  if (rel === base) return true
  const prefix = base.endsWith(sep) ? base : base + sep
  return rel.startsWith(prefix)
}

/**
 * Paths sensíveis sob home: abertos só com flag risky (confirmação curta no chat).
 * Ainda dentro da allowlist — nunca System32 / fora de home.
 */
const RISKY_SEGMENTS = [
  '.ssh',
  '.gnupg',
  '.aws',
  '.azure',
  'appdata',
  'application data',
]

export function isRiskyPath(resolved: string, roots: PathRoots): boolean {
  const lower = resolved.toLowerCase()
  // Fora das pastas "comuns" mas ainda sob home → risky.
  const common = [
    roots.desktop,
    roots.downloads,
    roots.documents,
    roots.pictures,
    roots.music,
    roots.videos,
  ]
  const inCommon = common.some((r) => isPathInside(resolved, r))
  if (!inCommon && isPathInside(resolved, roots.home) && resolved !== roots.home) {
    // Arquivo/pasta solta na home: ok leve, não risky.
    // Mas segmentos sensíveis sim.
  }
  return RISKY_SEGMENTS.some((seg) => {
    const needle = sep + seg + sep
    const asDir = sep + seg
    return (
      lower.includes(needle) ||
      lower.endsWith(asDir) ||
      lower.endsWith(sep + seg)
    )
  })
}

/**
 * Resolve path do usuário contra raízes permitidas.
 * - absoluto: precisa estar sob home (ou raiz comum)
 * - relativo / nome: tenta alias de pasta, senão resolve sob Downloads (mais seguro)
 * - rejeita `..` que escape
 */
export function resolveSafePath(
  raw: string,
  roots: PathRoots = defaultPathRoots(),
  opts?: { preferRoot?: keyof PathRoots },
): SafePathResult {
  const trimmed = raw.trim().replace(/^["']|["']$/g, '')
  if (!trimmed) {
    return { ok: false, reason: 'Caminho vazio' }
  }

  if (trimmed.includes('\0')) {
    return { ok: false, reason: 'Caminho inválido' }
  }

  // Alias puro de pasta comum
  const alias = resolveFolderAlias(trimmed, roots)
  if (alias && !trimmed.includes(sep) && !trimmed.includes('/') && !trimmed.includes('\\')) {
    return { ok: true, path: resolve(alias), risky: false }
  }

  const baseRoot = roots[opts?.preferRoot ?? 'downloads']
  let candidate: string

  if (isAbsolute(trimmed)) {
    candidate = resolve(normalize(trimmed))
  } else {
    // Bloqueia escape óbvio antes de resolve
    const norm = normalize(trimmed)
    candidate = resolve(baseRoot, norm)
  }

  const allowedRoots = [
    roots.home,
    roots.desktop,
    roots.downloads,
    roots.documents,
    roots.pictures,
    roots.music,
    roots.videos,
  ]

  const inside = allowedRoots.some((root) => isPathInside(candidate, root))
  if (!inside) {
    return {
      ok: false,
      reason:
        'Caminho fora das pastas permitidas (home, Desktop, Downloads, Documentos…).',
    }
  }

  // Dupla checagem: relative não pode começar com ..
  for (const root of allowedRoots) {
    if (isPathInside(candidate, root)) {
      const rel = candidate.slice(resolve(root).length)
      if (rel.includes(`..${sep}`) || rel.startsWith(`..`)) {
        return { ok: false, reason: 'Path traversal bloqueado' }
      }
    }
  }

  return {
    ok: true,
    path: candidate,
    risky: isRiskyPath(candidate, roots),
  }
}

export function listFolderAliases(): string[] {
  return [...new Set(Object.keys(FOLDER_ALIASES))].sort()
}
