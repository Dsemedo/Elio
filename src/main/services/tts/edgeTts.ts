import { createHash, randomUUID } from 'node:crypto'
import { prepareTextForSpeech } from '../../../shared/ttsPolicy'
import { buildEdgeSsml } from './ssml'

/**
 * Cliente mínimo do protocolo Edge Read Aloud (mesmo usado pelo edge-tts).
 * Sem API key; exige rede. Áudio MP3 em memória — sem gravar texto em disco.
 *
 * Least privilege: só fala com speech.platform.bing.com / edge.microsoft.com;
 * spawn nenhum; shell:false N/A (WebSocket puro).
 */

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
/** Segundos entre 1601-01-01 e 1970-01-01 (Windows FILETIME epoch). */
const WIN_EPOCH_OFFSET_SEC = 11_644_473_600
const CHROMIUM_FULL_VERSION = '130.0.2849.68'

export type EdgeSynthesizeResult = {
  audioBase64: string
  mimeType: 'audio/mpeg'
  voice: string
  chars: number
}

export class EdgeTtsError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(`${code}: ${message}`)
    this.code = code
    this.name = 'EdgeTtsError'
  }
}

function secMsGec(): string {
  const ticks = Math.floor(Date.now() / 1000 + WIN_EPOCH_OFFSET_SEC)
  const rounded = ticks - (ticks % 300)
  const payload = `${rounded}${TRUSTED_CLIENT_TOKEN}`
  return createHash('sha256').update(payload, 'utf8').digest('hex').toUpperCase()
}

function wsUrl(connectionId: string): string {
  const gec = secMsGec()
  const params = new URLSearchParams({
    TrustedClientToken: TRUSTED_CLIENT_TOKEN,
    ConnectionId: connectionId,
    'Sec-MS-GEC': gec,
    'Sec-MS-GEC-Version': `1-${CHROMIUM_FULL_VERSION}`,
  })
  return `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?${params}`
}

function configMessage(): string {
  const body = JSON.stringify({
    context: {
      synthesis: {
        audio: {
          metadataoptions: {
            sentenceBoundaryEnabled: 'false',
            wordBoundaryEnabled: 'false',
          },
          outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
        },
      },
    },
  })
  return (
    `X-Timestamp:${new Date().toISOString()}\r\n` +
    `Content-Type:application/json; charset=utf-8\r\n` +
    `Path:speech.config\r\n\r\n` +
    body
  )
}

function ssmlMessage(requestId: string, ssml: string): string {
  return (
    `X-RequestId:${requestId}\r\n` +
    `Content-Type:application/ssml+xml\r\n` +
    `X-Timestamp:${new Date().toISOString()}\r\n` +
    `Path:ssml\r\n\r\n` +
    ssml
  )
}

/**
 * Extrai bytes de áudio de um frame binário do protocolo Edge
 * (header UTF-8 + \r\n\r\n + payload).
 */
export function extractAudioFromBinaryFrame(data: ArrayBuffer | Buffer): Buffer | null {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
  const sep = Buffer.from('\r\n\r\n')
  const idx = buf.indexOf(sep)
  if (idx < 0) return null
  const header = buf.subarray(0, idx).toString('utf8')
  if (!/Path:\s*audio/i.test(header)) return null
  return buf.subarray(idx + sep.length)
}

let activeAbort: AbortController | null = null

export function abortEdgeSynthesis(): void {
  activeAbort?.abort()
  activeAbort = null
}

export async function synthesizeEdgeMp3(input: {
  text: string
  voice: string
  signal?: AbortSignal
}): Promise<EdgeSynthesizeResult> {
  const text = prepareTextForSpeech(input.text)
  if (!text) {
    throw new EdgeTtsError('TTS_EMPTY', 'Nada para falar')
  }

  abortEdgeSynthesis()
  const ac = new AbortController()
  activeAbort = ac
  if (input.signal) {
    if (input.signal.aborted) {
      throw new EdgeTtsError('TTS_ABORTED', 'Síntese cancelada')
    }
    input.signal.addEventListener('abort', () => ac.abort(), { once: true })
  }

  const connectionId = randomUUID().replace(/-/g, '')
  const requestId = randomUUID().replace(/-/g, '')
  const ssml = buildEdgeSsml(text, input.voice)
  const url = wsUrl(connectionId)

  const chunks: Buffer[] = []

  await new Promise<void>((resolve, reject) => {
    let settled = false
    const fail = (err: Error): void => {
      if (settled) return
      settled = true
      try {
        ws.close()
      } catch {
        /* ignore */
      }
      reject(err)
    }
    const ok = (): void => {
      if (settled) return
      settled = true
      resolve()
    }

    let ws: WebSocket
    try {
      ws = new WebSocket(url)
    } catch (err) {
      reject(
        new EdgeTtsError(
          'TTS_EDGE_UNAVAILABLE',
          err instanceof Error ? err.message : 'WebSocket indisponível',
        ),
      )
      return
    }

    const onAbort = (): void => {
      try {
        ws.close()
      } catch {
        /* ignore */
      }
      fail(new EdgeTtsError('TTS_ABORTED', 'Síntese cancelada'))
    }
    ac.signal.addEventListener('abort', onAbort, { once: true })

    const timer = setTimeout(() => {
      fail(new EdgeTtsError('TTS_TIMEOUT', 'Tempo esgotado na síntese edge-tts'))
    }, 30_000)

    ws.binaryType = 'arraybuffer'

    ws.addEventListener('open', () => {
      try {
        ws.send(configMessage())
        ws.send(ssmlMessage(requestId, ssml))
      } catch (err) {
        clearTimeout(timer)
        fail(
          new EdgeTtsError(
            'TTS_EDGE_SEND',
            err instanceof Error ? err.message : 'Falha ao enviar SSML',
          ),
        )
      }
    })

    ws.addEventListener('message', (event) => {
      if (typeof event.data === 'string') {
        if (/Path:\s*turn.end/i.test(event.data)) {
          clearTimeout(timer)
          try {
            ws.close()
          } catch {
            /* ignore */
          }
          ok()
        }
        return
      }
      const audio = extractAudioFromBinaryFrame(event.data as ArrayBuffer)
      if (audio && audio.length > 0) chunks.push(audio)
    })

    ws.addEventListener('error', () => {
      clearTimeout(timer)
      fail(new EdgeTtsError('TTS_EDGE_NETWORK', 'Falha de rede no edge-tts (offline?)'))
    })

    ws.addEventListener('close', () => {
      clearTimeout(timer)
      if (!settled) {
        if (chunks.length > 0) ok()
        else
          fail(
            new EdgeTtsError('TTS_EDGE_CLOSED', 'Conexão edge-tts encerrada sem áudio'),
          )
      }
    })
  }).finally(() => {
    if (activeAbort === ac) activeAbort = null
  })

  if (chunks.length === 0) {
    throw new EdgeTtsError('TTS_EDGE_EMPTY', 'edge-tts não retornou áudio')
  }

  const audio = Buffer.concat(chunks)
  return {
    audioBase64: audio.toString('base64'),
    mimeType: 'audio/mpeg',
    voice: input.voice,
    chars: text.length,
  }
}
