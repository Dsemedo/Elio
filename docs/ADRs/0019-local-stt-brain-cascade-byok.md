# ADR 0019 — STT local + cérebro local + cascata só BYOK (SKU vitalício)

**Status:** aceito (direção de produto; implementação em PRs futuros — Fase A0a–A0c)  
**Data:** 2026-11-18  
**Guia de handoff:** [`docs/melhoria-latencia-voz-pos-kobi.md`](../melhoria-latencia-voz-pos-kobi.md)  
**Supersede parcialmente:** ADR 0002 (papel de Whisper), ADR 0008 (alvo de `auto`)  
**Estende:** ADR 0005 (router), ADR 0011 (escopo da cascata)

## Contexto

O código atual usa Whisper.cpp como STT `auto` (ADR 0002 / 0008) e manda small talk / chat genérico para a cascata OpenRouter → free → Ollama (ADR 0011). Isso:

- estoura metas de latência (1–3 s após soltar o PTT);
- torna “oi” dependente de hub/rede;
- não fecha um **SKU vitalício** (pagamento único) se STT ou LLM default rodarem na conta do vendedor.

Inspiração de modelo (não código): apps como [Kobi](https://hiagorzandonadi.github.io/kobi/) — local no dia a dia, nuvem opcional com chave do usuário.

## Decisão

### Papéis (não misturar)

| Camada | Default do SKU vitalício |
|--------|---------------------------|
| **STT** | Sempre **local** no PC. Alvo: Sherpa-ONNX ou Vosk pt-BR (ou helper COM Windows fora do Chromium se a aposta for Windows-first nativo). Whisper.cpp só como **fallback degradado**. Web Speech no renderer **fora** do `auto`. Groq/xAI **não** são ouvido. |
| **Cérebro de porta** | Sempre **local** (regras + manifesto de capacidades; LLM local só desempate opcional). Sempre recebe o turno. |
| **Ações no PC** | Allowlist local (ADR 0005) — opens, Spotify, etc. |
| **Cascata LLM** | Só quando o cérebro local classificar pedido pesado (`CLOUD:kind`) **e** o usuário tiver conectado provedor (BYOK). Sem chave → resposta falada pedindo conexão. **Zero key do vendedor** no instalador/default. |
| **TTS** | Local / sistema (Fase A1 do roadmap) |

### Modelo econômico

Dogfood = o que será vendido: ouvir + decidir + opens + “oi” **sem** custo de API do vendedor. Trabalho pesado (imagem, site, código) = **cliente** paga com a própria chave/cota.

### Router

Estender `classifyUserIntent` (ADR 0005): além das lanes A–C, small talk local e lane de escalação `LOCAL` vs `CLOUD:kind` + manifesto versionado. “oi” / “abre o Chrome” **não** passam por hub no default do SKU.

### Relação com Fase E / ADR 0011

A cascata OpenRouter/Ollama e a Fase E (multi-provedor nativo) continuam válidas **somente** para pedidos já escalados pelo cérebro local e com provedor conectado. Não são STT nem default de small talk.

## Alternativas rejeitadas

| Opção | Motivo |
|-------|--------|
| Whisper `medium`/`large` como solução | Ainda lento / pesado; não resolve o modelo econômico sozinho |
| STT cloud na conta do vendedor (ex.: Groq “free”) | Escala e segurança; SKU vitalício não fecha |
| Patchar Web Speech no Electron de novo | Já falhou no produto (ADR 0008); fora do `auto` |
| Extrair ditado do Cursor | Não existe SDK; recurso do produto Cursor |
| Cascata ADR 0011 como default de “oi” | Depende de hub; contradiz offline / SKU |

## Consequências

- Roadmap Fase A ganha A0a–A0c (ouvido + cérebro + escalate) antes de abrir Fase E completa.
- ADR 0002: Whisper deixa de ser o *alvo* primário de produto; subprocess permanece enquanto for fallback.
- ADR 0008: direção de `auto` muda; implementação pode permanecer Whisper até o PR de STT novo.
- Código atual **ainda** é Whisper + hub para chat — docs marcam legado vs alvo até os PRs A0.
- Checklist de aceite (offline, sem key do vendedor): ver guia §9.
