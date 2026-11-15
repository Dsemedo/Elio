/**
 * Electron 42+ no longer downloads its binary in npm's postinstall.
 * electron-vite needs node_modules/electron/path.txt — without it you get
 * "Error: Electron uninstall". This script downloads the binary when missing.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)

function resolveElectronRoot() {
  try {
    return dirname(require.resolve('electron/package.json'))
  } catch {
    console.warn('[elio] pacote electron ainda não está instalado; pulando download.')
    return null
  }
}

function isBinaryReady(electronRoot) {
  const pathTxt = join(electronRoot, 'path.txt')
  if (!existsSync(pathTxt)) return false
  // path.txt names the executable under dist/ (e.g. electron.exe on Windows)
  try {
    const rel = readFileSync(pathTxt, 'utf8').trim()
    return Boolean(rel) && existsSync(join(electronRoot, 'dist', rel))
  } catch {
    return false
  }
}

const electronRoot = resolveElectronRoot()
if (!electronRoot) {
  process.exit(0)
}

if (isBinaryReady(electronRoot)) {
  console.log('[elio] Electron já está pronto.')
  process.exit(0)
}

console.log('[elio] Baixando o Electron (primeira vez pode demorar)...')
const installJs = join(electronRoot, 'install.js')
const result = spawnSync(process.execPath, [installJs], {
  stdio: 'inherit',
  env: process.env,
})

if (result.status !== 0) {
  console.error(
    '[elio] Falha ao baixar o Electron. Tente de novo: npm run ensure:electron',
  )
  process.exit(result.status ?? 1)
}

if (!isBinaryReady(electronRoot)) {
  console.error('[elio] Download terminou, mas o executável não apareceu.')
  process.exit(1)
}

console.log('[elio] Electron pronto.')
