# ADR 0005 — Opens no desktop + intent router PT-BR

**Status:** aceito  
**Data:** 2026-11-15  
**Versão:** 0.8.0

## Contexto

Douglas confirmou o modelo de produto:

voz/texto → classificar intent →

- **(A)** ação no PC (abrir site / pasta / arquivo / app)
- **(B)** fato local ou tempo real (hora, clima por local)
- **(C)** ler aba aberta do browser / pesquisa web — **depois** (extensão ou CDP)
- conversa geral → LLM

A Floating Bar em 0.7.x expandia a janela no erro de mic e deixava um painel transparente ilegível (“fantasma”) sobre o wallpaper.

## Decisão

1. **Router leve** (`services/tools/router.ts`): classificador PT-BR por regex/aliases — sem multi-agente.
2. **(A)** allowlist: só `shell.openExternal` (https) e `shell.openPath`. Sem `exec` / PowerShell. Paths sob home + pastas comuns; `..` fora das raízes = bloqueado. Paths sensíveis (ex.: `.ssh`) pedem “confirma abrir …”.
3. **(B)** continua via `enrichMessagesWithLocalFacts` (hora/clima) quando a lane é `local_fact` ou cai no chat enriquecido.
4. **(C)** detectado e respondido com honestidade (“em breve / precisa extensão ou CDP”) — **não implementado** neste PR.
5. **UI:** erro de mic **dentro** da cápsula grafite opaca (`#191D24`); overlay só para o menu; rechecagem de devices no foco/`devicechange` sem expandir a janela. “Nenhum microfone encontrado” permanece válido (lista vazia / mau contato).

## Consequências

- Opens seguros e testáveis por unit tests (URL, path, intent).
- Lane C fica documentada e detectável; implementação real espera extensão/CDP.
- Barra deixa de criar hit-area fantasma no erro.
