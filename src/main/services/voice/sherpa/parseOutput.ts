/**
 * sherpa-onnx-offline imprime JSON por linha no stdout (`{"text":"..."}`).
 */

export function parseSherpaStdout(stdout: string): string {
  const lines = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (!line || !line.startsWith('{')) continue
    try {
      const parsed = JSON.parse(line) as { text?: unknown }
      if (typeof parsed.text === 'string') {
        return parsed.text.trim()
      }
    } catch {
      // tenta linha anterior
    }
  }

  // Fallback: texto cru (versões antigas / debug)
  const joined = lines.join(' ').trim()
  if (joined && !joined.startsWith('{')) return joined
  return ''
}
