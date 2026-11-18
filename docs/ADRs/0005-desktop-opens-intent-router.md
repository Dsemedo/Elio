# ADR 0005 — Opens no desktop + intent router PT-BR

**Status:** aceito (estendido em direção por [ADR 0019](./0019-local-stt-brain-cascade-byok.md) — 2026-11-18)  
**Data:** 2026-11-15  
**Versão:** 0.8.0

## Contexto

Douglas confirmou o modelo de produto:

voz/texto → classificar intent →

- **(A)** ação no PC (abrir site / pasta / arquivo / app)
- **(B)** fato local ou tempo real (hora, clima por local)
- **(C)** ler aba aberta do browser / pesquisa web — **depois** (extensão ou CDP)
- conversa geral → LLM *(legado no código; ADR 0019 muda o alvo)*

A Floating Bar em 0.7.x expandia a janela no erro de mic e deixava um painel transparente ilegível (“fantasma”) sobre o wallpaper.

## Decisão

1. **Router leve** (`services/tools/router.ts`): classificador PT-BR por regex/aliases — sem multi-agente.
2. **(A)** allowlist: só `shell.openExternal` (https) e `shell.openPath`. Sem `exec` / PowerShell. Paths sob home + pastas comuns; `..` fora das raízes = bloqueado. Paths sensíveis (ex.: `.ssh`) pedem “confirma abrir …”.
3. **(B)** continua via `enrichMessagesWithLocalFacts` (hora/clima) quando a lane é `local_fact` ou cai no chat enriquecido.
4. **(C)** na 0.8.0: detectado e deferred. **Atualizado na 0.15.0 / ADR 0013:** aba ativa = status honesto sem extensão; pesquisa = open https + fetch allowlist.
5. **UI:** erro de mic **dentro** da cápsula grafite opaca (`#191D24`); overlay só para o menu; rechecagem de devices no foco/`devicechange` sem expandir a janela. “Nenhum microfone encontrado” permanece válido (lista vazia / mau contato).

### Extensão planejada (ADR 0019 / Fase A0b–A0c) — ainda não no código

Lanes A–C permanecem. O default de “conversa geral → hub LLM” **deixa de ser o norte**:

| Destino | Comportamento alvo |
|---------|-------------------|
| Small talk (“oi”, “bom dia”) | **Local** — resposta curta sem hub / sem rede |
| Opens / Spotify / fatos locais | **Local** (`pc_action` / `local_fact`) |
| Pedido pesado (imagem, site completo, codegen…) | Lane **`escalate`** (ou equivalente) com `CLOUD:kind` |
| Sem provedor BYOK para o `kind` | Mensagem falada “conecte uma IA” — **não** chama API do vendedor |
| Manifesto de capacidades | Lista versionada no app: o que o local sabe vs o que exige nuvem |

Ordem de classificação sugerida: regras → manifesto → (opcional) LLM local de desempate → executar ou escalar. Detalhe e checklist: [`melhoria-latencia-voz-pos-kobi.md`](../melhoria-latencia-voz-pos-kobi.md).

## Consequências

- Opens seguros e testáveis por unit tests (URL, path, intent).
- Lane C fica documentada e detectável; implementação real espera extensão/CDP.
- Barra deixa de criar hit-area fantasma no erro.
- Até A0b–A0c, “oi” no código ainda pode cair em `routeCompletion` — tratar como débito vs ADR 0019.
