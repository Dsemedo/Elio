/**
 * Smoke da config de distribuição Windows (CI Linux).
 * Não gera NSIS (precisa Windows/Wine); só valida o YAML + scripts.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ymlPath = join(root, 'electron-builder.yml')
const pkgPath = join(root, 'package.json')

const yml = readFileSync(ymlPath, 'utf8')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

const requiredSnippets = [
  ['appId', /appId:\s*com\.elio\.app/],
  ['productName', /productName:\s*Elio/],
  ['win nsis target', /target:\s*\n\s*-\s*target:\s*nsis/],
  ['nsis oneClick false', /oneClick:\s*false/],
  ['nsis allowToChangeInstallationDirectory', /allowToChangeInstallationDirectory:\s*true/],
  ['publish github', /provider:\s*github/],
  ['publish owner', /owner:\s*Dsemedo/],
  ['publish repo', /repo:\s*Elio/],
  ['forceCodeSigning false', /forceCodeSigning:\s*false/],
]

const errors = []

for (const [label, re] of requiredSnippets) {
  if (!re.test(yml)) {
    errors.push(`electron-builder.yml: falta ou inválido — ${label}`)
  }
}

if (!pkg.dependencies?.['electron-updater']) {
  errors.push('package.json: electron-updater deve estar em dependencies (runtime)')
}

for (const script of ['dist', 'dist:win', 'release:win', 'check:builder']) {
  if (typeof pkg.scripts?.[script] !== 'string') {
    errors.push(`package.json: script ausente — ${script}`)
  }
}

if (!pkg.repository?.url?.includes('Dsemedo/Elio')) {
  errors.push('package.json: repository.url deve apontar para Dsemedo/Elio')
}

if (errors.length > 0) {
  console.error('check-builder-config FAILED:')
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

console.log('check-builder-config OK (NSIS + GitHub publish + updater dep)')
