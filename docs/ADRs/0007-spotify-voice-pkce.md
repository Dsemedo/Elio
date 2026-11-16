# ADR 0007 — Spotify por voz (PKCE + fallback URI)

**Status:** aceito  
**Data:** 2026-11-15  
**Versão:** 0.10.0

## Contexto

Douglas pediu: voz/texto (“Elio, tocar música no Spotify” / “toca uma música no Spotify”) → abrir o Spotify e iniciar reprodução. Preferência: Web API com OAuth PKCE; fallback abrir o app via URI allowlisted. Sem `exec` arbitrário. Tokens criptografados em `userData`.

## Decisão

1. **Preferido:** Spotify Web API (Authorization Code + **PKCE**, client público). Escopos mínimos: `user-modify-playback-state`, `user-read-playback-state`, `user-read-recently-played`. Sem client secret no app.
2. **Playback:** com nome de faixa → Search (`/v1/search?type=track`) + `PUT /v1/me/player/play` com `uris`; sem nome → retomar ou primeira faixa de *recently played* (**atualizado na ADR 0017 / 0.18.0**). Requer **Spotify Premium** para controle remoto na maioria dos dispositivos — se a API devolver `PREMIUM_REQUIRED` / 403, mensagem clara em PT e o app já foi aberto.
3. **Fallback / ativação:** sempre tenta abrir via allowlist `spotify:` ou `https://open.spotify.com` com `shell.openExternal` (mesmo padrão do ADR 0005). Sem PowerShell/`child_process.exec`.
4. **Segredos:** access/refresh tokens só no main, arquivo binário sob `userData`, cifrado com `safeStorage` **async** do Electron (`isAsyncEncryptionAvailable` / `encryptStringAsync` / `decryptStringAsync` — sync deprecado no 45). Nunca logar tokens; se criptografia indisponível, não gravar em texto puro.
5. **Client ID:** `ELIO_SPOTIFY_CLIENT_ID` (Dashboard Spotify do Douglas). Redirect loopback `http://127.0.0.1:47821/callback`.
6. **Router:** lane A (`pc_action`) com intents `spotify_play` / `spotify_connect`, no mesmo fluxo da PR #15.
7. **UI:** Floating Bar mostra “Abrindo Spotify…”; Integrações ganha stub “Conectar Spotify”.

## Alternativas rejeitadas

| Opção | Motivo |
|-------|--------|
| Só abrir URI sem API | Não inicia play de forma confiável; Premium + API é o caminho oficial |
| Client secret embutido | Violaria least-privilege / segredos no binário |
| `keytar` neste PR | `safeStorage` já cobre “criptografado em userData” sem nova dep |
| Shell/`start spotify` | Fora da allowlist segura (ADR 0005) |

## Consequências

- Conta free: Elio abre o Spotify e explica que o play remoto precisa de Premium + conexão.
- Sem Client ID: fallback de abrir o app ainda funciona; connect API fica “configurar”.
- Busca de música por nome: **feito na ADR 0017**. UI de playlists continua fora de escopo.
