# ADR 0017 — Fatia 1: opens no browser + Spotify por nome

## Status

Aceito (2026-11-16)

## Contexto

A Fatia 1 do produto pede o loop **falar → confirmar → agir**: “toca [faixa] no Spotify” e “abre o Google Maps no Chrome” (e compostos como Edge + Instagram). Até 0.17.x o Spotify só retomava play/recente; Chrome/Edge eram aliases do navegador padrão; não havia Maps nem opens compostos.

## Decisão

1. **Aliases de site:** `google maps` / `maps` → `https://www.google.com/maps` (e outros úteis).
2. **Browser específico:** intent `open_url` com `browserId: chrome|edge`. Execução: `execFile` no path allowlisted (`chrome.exe` / `msedge.exe`) + **único** argumento = URL `https` já validada (`shell: false`). Se o exe não existir, fallback `openExternal` (navegador padrão) com mensagem clara.
3. **Compostos:** `abre A e B` → `open_many` (2–4 itens), cada um parseado pela mesma allowlist.
4. **Spotify por nome:** `spotify_play` ganha `query: string | null`. Com query → Search API (`/v1/search?type=track`) → `uris` no play. Sem query → comportamento anterior (resume / recente). Mensagens no tom “Estou colocando…”.
5. **Fora desta fatia:** TTS auto em PTT; cliques UI Automation; atalhos Win/Alt.

## Consequências

- Demo alinhada ao produto: Maps no Chrome e faixa no Spotify usam o mesmo padrão de ação allowlisted.
- Quem já conectou Spotify pode precisar **reconectar** se o Dashboard exigir reautorização (search usa o mesmo token de usuário; escopos atuais bastam para catálogo público).
- Chrome/Edge só no Windows nesta fatia.
