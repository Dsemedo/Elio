# ADR 0012 — Memória persistente + settings (cofre / export / delete-all)

**Status:** aceito  
**Data:** 2026-11-15  
**Versão:** 0.14.1  
**Tarefa:** PJ-35

## Contexto

RF-04 / security.md pedem memória explícita (CRUD) injetada no contexto, API keys no cofre do SO, exportar e apagar todos os dados. O chat já usa JSON em `userData` (SQLite adiado). Spotify já grava tokens com `safeStorage` async. `keytar` está arquivado (OD-01). PJ-32 (Command Center UX) corre em paralelo — não redesenhar chat/histórico neste PR.

## Decisão

1. **Memórias:** JSON `elio-memories.json` em `userData`, CRUD via IPC tipado + Zod. Limites: 50 itens, 500 chars, tags opcionais. UI na seção **Memória** do Command Center (stub removido).
2. **Injeção:** bloco “Memórias explícitas…” no system prompt de `enrichMessagesWithLocalFacts`, com orçamento de ~3500 chars (mais recentes primeiro).
3. **Chaves:** OpenRouter via `safeStorage` async (mesmo padrão Spotify), arquivo `secrets/openrouter-api-key.bin`. Env `OPENROUTER_API_KEY` continua como fallback. Renderer só envia a chave (one-way) e vê `source: vault|env|none` — nunca o valor de volta.
4. **Settings UI:** sub-nav Configurações → Integrações | Computador | Dados (alinha benchmark sem brigar com PJ-32). Integrações: campo de chave OpenRouter. Dados: export JSON + apagar tudo (confirmação dupla).
5. **Export:** conversas + memórias + cidade do clima. **Sem** keys/tokens.
6. **Delete-all:** remove chat JSON, memórias, location cache, OpenRouter key file, Spotify tokens. Não remove modelo Whisper.

## Alternativas rejeitadas

| Opção | Motivo |
|-------|--------|
| `keytar` | Pacote arquivado; rebuild frágil; Spotify já validou safeStorage |
| SQLite neste PR | Chat ainda é JSON; unificar depois |
| Redesenhar lista de threads / header do chat | Escopo PJ-32 — evitar conflito |

## Relação com PR #21 / #22

Cascata BYOK (#22) usa o mesmo cofre OpenRouter e `settings`. Export/delete-all limpa a chave e `elio-settings.json` sem alterar a lógica de tiers.

## Relação com PR #21

Settings/OpenRouter UI e cofre (`settings/openrouter-secret.ts`, `elio-settings.json`) vieram do Command Center UX. Este ADR acrescenta memórias + export/delete-all sem duplicar a UI de chave.

## Consequências

- Memória implícita continua fora (OD-16).
- Cascata BYOK completa (PJ-34) pode reutilizar o vault de API keys.
- Sem criptografia do SO: não grava chave em texto puro; usuário usa env.
