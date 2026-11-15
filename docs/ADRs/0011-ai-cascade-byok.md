# ADR 0011 — Cascata de IAs BYOK → cota grátis → Ollama

**Status:** aceito  
**Data:** 2026-11-15  
**Versão:** 0.14.0  
**Issue:** PJ-34

## Contexto

O roteador antigo priorizava Ollama e só caía no OpenRouter se o local estivesse offline. A preferência do produto (e o backlog PJ-34) inverte isso: se o usuário conectou chave própria, ela manda; senão usa cotas grátis; Ollama fica como fallback local. Ainda não há OAuth direto ChatGPT/Gemini — OpenRouter cobre modelos free e pagos com uma chave.

## Decisão

1. **Cascata automática (nesta ordem):**
   1. **BYOK** — `OPENROUTER_API_KEY` + `OPENROUTER_MODEL` **sem** sufixo `:free`.
   2. **Cota grátis** — mesma chave OpenRouter com modelo `:free` (padrão `meta-llama/llama-3.2-3b-instruct:free`).
   3. **Local** — Ollama em `OLLAMA_HOST` / `OLLAMA_MODEL`.
2. **Fallback em falha:** se BYOK falhar (402/429/rede), tenta free; se free falhar, tenta Ollama. Erros agregados sem vazar headers/keys.
3. **UI:** cada resposta LLM carrega `routeTier` + `servedByLabel` (ex.: `OpenRouter (cota grátis) · …`). Status expõe `preferredTier`, `cascadeOrder` e contadores de budget.
4. **Budget stub:** contadores em memória (`byok` / `free` / `local`). Limites opcionais via `ELIO_AI_BUDGET_*_DAILY`. Enforcement só com `ELIO_AI_BUDGET_ENFORCE=true` (desligado no MVP).
5. **Segredos:** chave só no env do processo main; nunca logar Authorization/body. Least privilege: só o scope de chat completions do OpenRouter.

## Caminho futuro (BYOK nativo)

| Etapa | O quê | Quando |
|-------|--------|--------|
| A (agora) | OpenRouter como hub BYOK + free | MVP |
| B | Campo de chave OpenRouter na UI + `safeStorage` (fatia settings / PJ-35) | próximo |
| C | Provedores diretos (OpenAI / Google) com chave no cofre — **sem** OAuth de conta ChatGPT/Gemini Plus | sob demanda |
| D | OAuth ChatGPT/Gemini | **fora** até decisão explícita (complexidade + ToS) |

Não inventar OAuth de assinatura ChatGPT/Gemini neste estágio: modelos equivalentes via OpenRouter bastam para validar a cascata.

## Alternativas rejeitadas

| Opção | Motivo |
|-------|--------|
| Manter Ollama primeiro | Contradiz preferência “chave conectada manda” e PJ-34 |
| OAuth ChatGPT/Gemini agora | Escopo grande, ToS, pouco ganho vs OpenRouter |
| Enforcement rígido de cotas | Precisa persistência + UX de limites; stub primeiro |

## Consequências

- Com Ollama + OpenRouter free ao mesmo tempo, a nuvem free atende antes do local (custo/latência trade-off consciente).
- Modelo pago no env ativa BYOK na frente; `:free` permanece o default seguro.
- Testes em `tests/router-order.test.ts` e `tests/ai-route.test.ts` fixam a ordem.
