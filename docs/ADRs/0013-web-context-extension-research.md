# ADR 0013 — Lane C: aba ativa via extensão; pesquisa web allowlisted (PJ-33)

## Status

Aceito (2026-11-15) · Versão **0.15.0** (após memória 0.14.1 / cascata BYOK 0.14.0 no main)

> Numeração: **0013** — no main, ADR 0012 = memória persistente; 0011 = cascata BYOK.

## Contexto

ADR 0005 deixou a lane **C** (ler aba / pesquisa web) detectável mas **deferred** (extensão ou CDP). Douglas pediu um MVP pragmático:

1. Honestidade sobre “o que está na aba” sem fingir capacidade.
2. Pesquisa leve: abrir URL https + opcionalmente ler texto público.
3. Least privilege — sem crawl arbitrário, sem CDP amplo no desktop.

Alternativas:

| Opção | Prós | Contras |
|-------|------|---------|
| **A. Extensão Chrome/Edge + native messaging** | Lê aba real com consentimento do usuário; escopo mínimo | Extensão ainda não existe neste PR |
| **B. CDP / remote debugging** | Acesso rico à página | Alto privilégio; frágil; incompatível com least privilege do MVP |
| **C. Só abrir busca no browser** | Simples | Não entrega contexto textual ao LLM |
| **D. Fetch HTTPS allowlist + open URL** | Texto público controlado; testável; SSRF mitigado | Só hosts conhecidos; sem JS renderizado |

## Decisão

1. **Aba ativa:** contrato em `tools/web/tab.ts`. Sem extensão → resposta honesta (`extension_missing`). **Não** usar CDP neste estágio. Extensão futura preenche o mesmo contrato.
2. **Pesquisa web:** `tools/web/research.ts` — `shell.openExternal` só https (mesmo validador dos opens) + **fetch opcional** de **um** URL em host allowlisted (`wikipedia.org`, MDN, docs Microsoft, electronjs.org, githubusercontent, etc.). Timeout 8s, teto de bytes/chars, redirect único revalidado, sem POST, sem seguir links.
3. **Router:** `classifyUserIntent` distingue `active_tab` vs `web_research` dentro de `web_context`.
4. **Prompt injection:** texto recuperado entra como bloco “NÃO CONFIÁVEL”; o LLM só resume; políticas/permissões continuam no código.
5. Resumos com LLM usam a cascata existente (`routeCompletion` / ADR 0011) e o enrich (hora/clima/memória) já no main.

## Consequências

- “O que está na aba?” deixa de parecer feature pronta e explica a extensão.
- “Pesquisa na web sobre X” abre Google Search; “na Wikipedia” / URL https allowlisted pode alimentar o LLM com trecho truncado.
- Crawl genérico, scraping de SERP e leitura de intranet/localhost permanecem **fora**.
- ADR 0005 permanece válido para opens A/B; este ADR substitui o “C deferred” por este MVP.
