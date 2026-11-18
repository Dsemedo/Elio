# ADR 0011 — Cascata de IAs BYOK → cota grátis → Ollama

**Status:** aceito (escopo de produto clarificado 2026-11-18 por [ADR 0019](./0019-local-stt-brain-cascade-byok.md))  
**Data:** 2026-11-15  
**Versão:** 0.14.0  
**Issue:** PJ-34

## Contexto

O roteador antigo priorizava Ollama e só caía no OpenRouter se o local estivesse offline. A preferência do produto (e o backlog PJ-34) inverte isso: se o usuário conectou chave própria, ela manda; senão usa cotas grátis; Ollama fica como fallback local. Ainda não há OAuth direto ChatGPT/Gemini — OpenRouter cobre modelos free e pagos com uma chave.

**Escopo (ADR 0019):** esta cascata é **só LLM** para turnos que o cérebro local já classificou como precisando de nuvem (`CLOUD:kind`) **e** o usuário tem provedor conectado. **Não** é STT. **Não** é o default de “oi” / opens no SKU vitalício. Sem chave do usuário → pedir conexão; **zero key do vendedor** no instalador/default.

## Decisão

1. **Quando rodar:** após classificação local exigir nuvem (ou, legado até A0b: lane `chat` atual). Small talk / opens locais **não** devem entrar aqui no alvo de produto.
2. **Cascata automática (nesta ordem), para quem conectou chave:**
   1. **BYOK** — `OPENROUTER_API_KEY` + `OPENROUTER_MODEL` **sem** sufixo `:free`.
   2. **Cota grátis** — mesma chave OpenRouter com modelo `:free` (padrão `meta-llama/llama-3.2-3b-instruct:free`).
   3. **Local** — Ollama em `OLLAMA_HOST` / `OLLAMA_MODEL`.
3. **Fallback em falha:** se BYOK falhar (402/429/rede), tenta free; se free falhar, tenta Ollama. Erros agregados sem vazar headers/keys.
4. **UI:** cada resposta LLM carrega `routeTier` + `servedByLabel` (ex.: `OpenRouter (cota grátis) · …`). Status expõe `preferredTier`, `cascadeOrder` e contadores de budget.
5. **Budget stub:** contadores em memória (`byok` / `free` / `local`). Limites opcionais via `ELIO_AI_BUDGET_*_DAILY`. Enforcement só com `ELIO_AI_BUDGET_ENFORCE=true` (desligado no MVP).
6. **Segredos:** chave só no env / `safeStorage` do processo main; nunca logar Authorization/body; nunca embutir key do vendedor. Least privilege: só o scope de chat completions do OpenRouter.

## Caminho futuro (BYOK nativo → multi-IA)

Alinhado ao horizonte de produto (**Fase E** em `docs/roadmap.md` / `docs/produto.md`), **depois** de A0a–A0c: o Elio roteia pedidos **já escalados** entre IAs conectadas, com cascata **pago → grátis → próxima IA → Ollama**.

| Etapa | O quê | Quando |
|-------|--------|--------|
| A (agora) | OpenRouter como hub BYOK + free | Feito (MVP) |
| B | Campo de chave OpenRouter na UI + `safeStorage` | Feito (settings) |
| C | Provedores diretos oficiais (Anthropic / OpenAI / Google) no cofre; cascata entre cotas | **Fase E** do roadmap |
| D | Cursor só com caminho oficial documentado | **Fase E** (E5) |
| E | OAuth de conta consumer (ChatGPT/Gemini “Plus”) | **fora** até ToS + decisão explícita — preferir API keys |

Não scrapear chat web nem inventar login fantasma: só APIs oficiais. OpenRouter continua válido como hub enquanto multi-provedor nativo não existir.

## Alternativas rejeitadas

| Opção | Motivo |
|-------|--------|
| Manter Ollama primeiro | Contradiz preferência “chave conectada manda” e PJ-34 |
| OAuth ChatGPT/Gemini agora | Escopo grande, ToS, pouco ganho vs OpenRouter |
| Enforcement rígido de cotas | Precisa persistência + UX de limites; stub primeiro |
| Usar esta cascata como ouvido / default de “oi” | Contradiz SKU vitalício e ADR 0019 |
| Key do vendedor no default | Escala e segurança — proibido |

## Consequências

- Com Ollama + OpenRouter free ao mesmo tempo, a nuvem free atende antes do local **nos turnos que entram na cascata** (custo/latência trade-off consciente).
- Modelo pago no env ativa BYOK na frente; `:free` permanece o default seguro **para quem colou chave**.
- Testes em `tests/router-order.test.ts` e `tests/ai-route.test.ts` fixam a ordem.
- Até A0b, “oi” no código ainda pode cair nesta cascata — débito documentado vs ADR 0019.
