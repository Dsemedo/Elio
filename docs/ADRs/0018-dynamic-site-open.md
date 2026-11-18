# ADR 0018 — Abrir site dinâmico com correção de STT

**Status:** aceito  
**Data:** 2026-11-16  
**Versão:** 0.18.2

## Contexto

A allowlist de aliases (`exame`, `google`, `instagram`…) não escala: Douglas pediu abrir **qualquer** site por nome (“abre o jornal O Popular”) sem cadastrar cada veículo. O STT Whisper frequentemente mangleia o artigo (“jornal **ou** popular”). Pedir confirmação humana a cada erro de ditado quebra o loop de voz.

## Decisão

1. Novo intent `open_site_query` para “abre o jornal/revista/portal …” e nomes livres após `abre` (exceto conversa/histórico).
2. Resolução: **alias/hostname → senão LLM** (`resolveSiteQueryDynamically`), com prompt que corrige mangling PT-BR.
3. **Validação automática:** só `https` via `validateHttpsUrl`; bloqueio de host privado/localhost; JSON estrito; pedido do usuário tratado como dados (não instrução).
4. **Sem depender do usuário para corrigir o STT:** se a URL passar na validação, abre direto e a resposta fala a correção (“corrigi de …”); Whisper também normaliza `jornal|revista|site ou` → `o` no pós-processamento.
5. Sem `exec`/PowerShell; open continua em `shell.openExternal`.

## Alternativas rejeitadas

| Opção | Motivo |
|-------|--------|
| Expandir lista de aliases | Não escala; “sem depender de mim” |
| Confirmar todo open dinâmico | Fricção no loop de voz; validação técnica já filtra URL |
| Abrir Google Search como “site” | Não abre o veículo pedido |

## Consequências

- Precisa OpenRouter/Ollama para nomes fora da lista; aliases e URLs https seguem offline.
- Risco residual: LLM pode apontar domínio errado com confiança — mitigado por https-only + mensagem explícita do que abriu.
- “Cria um site com IA” continua fora de escopo (outra ferramenta).

## Atualização 0.18.2

- “X no Edge/Chrome” preserva `browserId` também em `open_site_query` (antes só aliases).
- Normalização local: remove sufixo de browser do nome; **sem** hardcode de marcas.
- Correção de marcas/mangling (STT colado, New↔Neo, etc.) fica no **LLM** via prompt genérico; se não houver confiança no domínio oficial, `url` null (não inventar host).
