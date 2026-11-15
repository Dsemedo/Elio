import { createServer, type Server } from 'node:http'
import {
  SPOTIFY_AUTH_URL,
  SPOTIFY_LOOPBACK_PORT,
  SPOTIFY_REDIRECT_URI,
  SPOTIFY_SCOPES,
  getSpotifyClientId,
} from './config'
import { createPkcePair, randomState } from './pkce'
import { exchangeAuthCode } from './api'
import type { SpotifyTokenSet } from './tokens'

export type AuthOpener = {
  openExternal: (url: string) => Promise<void>
}

export type SpotifyAuthResult =
  | { ok: true; tokens: SpotifyTokenSet }
  | { ok: false; reason: string }

type PendingAuth = {
  state: string
  verifier: string
  server: Server
  settle: (result: SpotifyAuthResult) => void
}

let pending: PendingAuth | null = null

function htmlPage(title: string, body: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;background:#101216;color:#F4F5F7;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
main{max-width:28rem;padding:2rem;background:#191D24;border:1px solid #303742;border-radius:12px}
h1{font-size:1.25rem;margin:0 0 .75rem}p{color:#929BA8;line-height:1.5}</style></head>
<body><main><h1>${title}</h1><p>${body}</p></main></body></html>`
}

function stopPending(): void {
  if (!pending) return
  try {
    pending.server.close()
  } catch {
    // ignore
  }
  pending = null
}

/**
 * Inicia OAuth PKCE: sobe loopback, abre o browser do Spotify, troca o code.
 * Uma autenticação por vez.
 */
export async function startSpotifyAuth(opts?: {
  env?: NodeJS.ProcessEnv
  opener?: AuthOpener
  fetchImpl?: typeof fetch
  timeoutMs?: number
}): Promise<SpotifyAuthResult> {
  const env = opts?.env ?? process.env
  const clientId = getSpotifyClientId(env)
  if (!clientId) {
    return {
      ok: false,
      reason:
        'Defina ELIO_SPOTIFY_CLIENT_ID (app no Spotify Developer Dashboard) e reinicie o Elio.',
    }
  }

  if (pending) {
    return { ok: false, reason: 'Já há uma conexão Spotify em andamento.' }
  }

  const { verifier, challenge } = createPkcePair()
  const state = randomState()
  const timeoutMs = opts?.timeoutMs ?? 120_000

  const resultPromise = new Promise<SpotifyAuthResult>((resolve) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url ?? '/', `http://127.0.0.1:${SPOTIFY_LOOPBACK_PORT}`)
        if (url.pathname !== '/callback') {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end('Not found')
          return
        }

        const err = url.searchParams.get('error')
        if (err) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(
            htmlPage(
              'Conexão cancelada',
              'Você cancelou ou o Spotify recusou. Pode fechar esta aba e voltar ao Elio.',
            ),
          )
          const settle = pending?.settle
          stopPending()
          settle?.({ ok: false, reason: `Spotify OAuth: ${err}` })
          return
        }

        const code = url.searchParams.get('code')
        const returnedState = url.searchParams.get('state')
        if (!code || !returnedState || returnedState !== pending?.state) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(
            htmlPage(
              'Falha na conexão',
              'Estado OAuth inválido. Feche esta aba e tente “Conectar Spotify” de novo no Elio.',
            ),
          )
          const settle = pending?.settle
          stopPending()
          settle?.({ ok: false, reason: 'Callback OAuth inválido (state/code).' })
          return
        }

        const current = pending
        if (!current) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end('Sem sessão')
          return
        }

        const exchangeOpts: {
          code: string
          verifier: string
          env: NodeJS.ProcessEnv
          fetchImpl?: typeof fetch
        } = {
          code,
          verifier: current.verifier,
          env,
        }
        if (opts?.fetchImpl) exchangeOpts.fetchImpl = opts.fetchImpl

        void exchangeAuthCode(exchangeOpts)
          .then((tokens) => {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(
              htmlPage(
                'Spotify conectado',
                'Pode fechar esta aba e voltar ao Elio. Diga “toca uma música no Spotify”.',
              ),
            )
            const settle = pending?.settle
            stopPending()
            settle?.({ ok: true, tokens })
          })
          .catch(() => {
            res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(
              htmlPage(
                'Falha na conexão',
                'Não consegui trocar o código OAuth. Feche e tente de novo no Elio.',
              ),
            )
            const settle = pending?.settle
            stopPending()
            settle?.({
              ok: false,
              reason: 'Falha ao obter tokens do Spotify (sem detalhes sensíveis).',
            })
          })
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('Erro')
        const settle = pending?.settle
        stopPending()
        settle?.({ ok: false, reason: 'Erro no callback OAuth do Spotify.' })
      }
    })

    server.once('error', () => {
      stopPending()
      resolve({
        ok: false,
        reason: `Porta ${SPOTIFY_LOOPBACK_PORT} ocupada — feche o processo que a usa e tente de novo.`,
      })
    })

    pending = {
      state,
      verifier,
      server,
      settle: resolve,
    }

    server.listen(SPOTIFY_LOOPBACK_PORT, '127.0.0.1', () => {
      const authUrl = new URL(SPOTIFY_AUTH_URL)
      authUrl.searchParams.set('client_id', clientId)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('redirect_uri', SPOTIFY_REDIRECT_URI)
      authUrl.searchParams.set('scope', SPOTIFY_SCOPES)
      authUrl.searchParams.set('code_challenge_method', 'S256')
      authUrl.searchParams.set('code_challenge', challenge)
      authUrl.searchParams.set('state', state)

      const opener = opts?.opener
      if (!opener) {
        stopPending()
        resolve({ ok: false, reason: 'Opener OAuth ausente' })
        return
      }

      void opener.openExternal(authUrl.toString()).catch(() => {
        stopPending()
        resolve({ ok: false, reason: 'Não abri o navegador para o login Spotify.' })
      })
    })

    setTimeout(() => {
      if (!pending || pending.state !== state) return
      stopPending()
      resolve({
        ok: false,
        reason: 'Tempo esgotado no login Spotify. Tente “Conectar Spotify” de novo.',
      })
    }, timeoutMs)
  })

  return resultPromise
}

export function cancelSpotifyAuth(): void {
  if (!pending) return
  const settle = pending.settle
  stopPending()
  settle({ ok: false, reason: 'Conexão Spotify cancelada.' })
}
