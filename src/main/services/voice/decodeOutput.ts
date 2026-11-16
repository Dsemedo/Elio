/**
 * Decodifica o `.txt` do whisper-cli.
 *
 * O modelo às vezes emite byte inválido em UTF-8 (issue whisper.cpp #438).
 * No Windows também aparece CP1252 (`é` = 0xE9) lido como `` via utf8.
 */

/**
 * Prefer UTF-8; se houver U+FFFD e o resto for ASCII, cai em latin1 (CP1252).
 */
export function decodeWhisperOutputBytes(buf: Buffer): string {
  const asUtf8 = buf.toString('utf8')
  if (!asUtf8.includes('\uFFFD')) {
    return asUtf8.trim()
  }

  const nonAsciiWithoutReplacement = [...asUtf8].filter(
    (c) => c !== '\uFFFD' && c.charCodeAt(0) > 127,
  ).length

  if (nonAsciiWithoutReplacement === 0) {
    return buf.toString('latin1').trim()
  }

  return asUtf8.trim()
}
