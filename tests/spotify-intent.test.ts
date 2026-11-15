import { describe, expect, it } from 'vitest'
import {
  parseSpotifyIntent,
  describeSpotifyIntent,
  looksLikeSpotifyCommand,
} from '../src/main/services/spotify/intent'
import { validateSpotifyExternalUrl } from '../src/main/services/spotify/urls'
import { createPkcePair, base64Url } from '../src/main/services/spotify/pkce'
import { classifyUserIntent } from '../src/main/services/tools/router'
import { handleSpotifyIntent } from '../src/main/services/spotify/play'
import type { SecretCrypto } from '../src/main/services/spotify/tokens'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'

describe('parseSpotifyIntent (PT-BR)', () => {
  it('detecta tocar música no Spotify', () => {
    expect(parseSpotifyIntent('Elio, tocar música no Spotify')?.kind).toBe(
      'spotify_play',
    )
    expect(parseSpotifyIntent('toca uma música no Spotify')?.kind).toBe(
      'spotify_play',
    )
    expect(parseSpotifyIntent('pode tocar uma musica no spotify')?.kind).toBe(
      'spotify_play',
    )
    expect(parseSpotifyIntent('play spotify')?.kind).toBe('spotify_play')
  })

  it('detecta conectar / desconectar', () => {
    expect(parseSpotifyIntent('conectar Spotify')?.kind).toBe('spotify_connect')
    expect(parseSpotifyIntent('desconectar o Spotify')?.kind).toBe(
      'spotify_disconnect',
    )
  })

  it('não captura conversa sem Spotify/play', () => {
    expect(parseSpotifyIntent('olá, tudo bem?')).toBeNull()
    expect(parseSpotifyIntent('abre o site da Exame')).toBeNull()
    expect(parseSpotifyIntent('que horas são?')).toBeNull()
    expect(parseSpotifyIntent('toca nesse assunto comigo')).toBeNull()
  })

  it('describe + looksLike', () => {
    const intent = parseSpotifyIntent('toca uma música no Spotify')
    expect(intent).not.toBeNull()
    if (intent) {
      expect(describeSpotifyIntent(intent)).toMatch(/Abrindo Spotify/i)
    }
    expect(looksLikeSpotifyCommand('conectar Spotify')).toBe(true)
    expect(looksLikeSpotifyCommand('bom dia')).toBe(false)
  })
})

describe('validateSpotifyExternalUrl allowlist', () => {
  it('aceita spotify: e open.spotify.com https', () => {
    expect(validateSpotifyExternalUrl('spotify:').ok).toBe(true)
    expect(validateSpotifyExternalUrl('spotify:track:abc123XYZ').ok).toBe(true)
    expect(validateSpotifyExternalUrl('https://open.spotify.com').ok).toBe(true)
    expect(
      validateSpotifyExternalUrl('https://open.spotify.com/playlist/1').ok,
    ).toBe(true)
  })

  it('rejeita esquemas e hosts perigosos', () => {
    expect(validateSpotifyExternalUrl('javascript:alert(1)').ok).toBe(false)
    expect(validateSpotifyExternalUrl('http://open.spotify.com').ok).toBe(false)
    expect(validateSpotifyExternalUrl('https://evil.example/spotify').ok).toBe(
      false,
    )
    expect(validateSpotifyExternalUrl('spotify:evil:payload').ok).toBe(false)
    expect(
      validateSpotifyExternalUrl('https://user:pass@open.spotify.com/').ok,
    ).toBe(false)
  })
})

describe('PKCE helpers', () => {
  it('gera verifier/challenge URL-safe', () => {
    const { verifier, challenge } = createPkcePair()
    expect(verifier.length).toBeGreaterThanOrEqual(43)
    expect(challenge.length).toBeGreaterThan(20)
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(base64Url(Buffer.from('hi')).length).toBeGreaterThan(0)
  })
})

describe('classifyUserIntent — Spotify na lane A', () => {
  it('roteia play Spotify como pc_action/spotify', () => {
    const c = classifyUserIntent('toca uma música no Spotify')
    expect(c.lane).toBe('pc_action')
    if (c.lane === 'pc_action') {
      expect(c.action).toBe('spotify')
      if (c.action === 'spotify') {
        expect(c.spotify.kind).toBe('spotify_play')
      }
    }
  })

  it('abre site continua desktop', () => {
    const c = classifyUserIntent('abre o site da Exame')
    expect(c.lane).toBe('pc_action')
    if (c.lane === 'pc_action') {
      expect(c.action).toBe('desktop')
    }
  })
})

describe('handleSpotifyIntent — fallback open sem client id', () => {
  it('abre spotify: mesmo sem OAuth', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'elio-spotify-'))
    const opened: string[] = []
    const crypto: SecretCrypto = {
      isEncryptionAvailable: () => true,
      encryptString: (p) => Buffer.from(p, 'utf8'),
      decryptString: (b) => b.toString('utf8'),
    }
    try {
      const result = await handleSpotifyIntent(
        { kind: 'spotify_play' },
        {
          crypto,
          paths: { filePath: join(dir, 'tokens.bin') },
          opener: {
            openExternal: async (url) => {
              opened.push(url)
            },
          },
          env: {},
        },
      )
      expect(result.ok).toBe(true)
      expect(opened[0]).toMatch(/^spotify:/)
      expect(result.message).toMatch(/ELIO_SPOTIFY_CLIENT_ID|Abri o Spotify/i)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
