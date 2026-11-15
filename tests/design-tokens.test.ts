import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('design system tokens v1.1', () => {
  const css = readFileSync(join(__dirname, '../src/renderer/src/styles.css'), 'utf8')

  it('declara a paleta e tipografia Geist do DS', () => {
    expect(css).toContain('--elio-bg: #101216')
    expect(css).toContain('--elio-surface: #191d24')
    expect(css).toContain('--elio-accent: #72d9c0')
    expect(css).toContain('--elio-info: #a995ed')
    expect(css).toContain('--elio-radius-bar: 18px')
    expect(css).toContain("--elio-font: 'Geist Sans', system-ui, sans-serif")
    expect(css).toContain('--elio-type-xl: 20px')
    expect(css).toContain('--elio-motion-ease: ease-out')
  })

  it('respeita prefers-reduced-motion e focus ring', () => {
    expect(css).toContain('prefers-reduced-motion: reduce')
    expect(css).toContain('--elio-focus-ring')
  })

  it('mantém thinking neutro (sem roxo de processando)', () => {
    expect(css).toMatch(
      /\.fb-shell\.state-thinking[\s\S]*?252b34|surface-elevated|neutro/i,
    )
    expect(css).toContain('só badges de IA')
  })
})
