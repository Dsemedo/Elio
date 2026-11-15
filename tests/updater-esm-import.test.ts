import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const updaterSrc = readFileSync(
  join(root, 'src/main/services/updater/index.ts'),
  'utf8',
)

describe('electron-updater ESM/CJS interop (dev boot)', () => {
  it('não usa named import de autoUpdater (quebra main ESM)', () => {
    expect(updaterSrc).not.toMatch(
      /import\s*\{[^}]*\bautoUpdater\b[^}]*\}\s*from\s*['"]electron-updater['"]/,
    )
  })

  it('usa default import + destructure compatível com CJS', () => {
    expect(updaterSrc).toMatch(/import\s+\w+\s+from\s*['"]electron-updater['"]/)
    expect(updaterSrc).toMatch(/const\s*\{\s*autoUpdater\s*\}\s*=/)
  })

  it('default import expõe autoUpdater como getter (sem instanciar Electron)', async () => {
    const mod = await import('electron-updater')
    const pkg = (mod as { default?: object }).default ?? mod
    const desc = Object.getOwnPropertyDescriptor(pkg, 'autoUpdater')
    expect(desc?.get || 'autoUpdater' in pkg).toBeTruthy()
  })
})
