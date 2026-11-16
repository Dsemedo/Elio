# Elio — roadmap de produto

**Status:** vigente  
**Atualizado:** 2026-11-16  
**Âncora:** [`produto.md`](./produto.md)  
**Versão base:** v0.17.x

Este documento responde **quando** e **em que ordem**. Não redefine o norte — se conflitar com [`produto.md`](./produto.md), o produto vence.

---

## Estado honesto (hoje)

| Capacidade | Estado | Nota |
|------------|--------|------|
| Floating Bar + PTT | Base pronta | Hold-to-talk |
| STT (Whisper local) | Base pronta | Primário; Speech opcional via env |
| TTS (system / edge) | Parcial | **Off por padrão** — desalinha a frase-norte |
| Confirmação falada antes da ação | Parcial | Status textual; TTS fala resposta final se ligado |
| Abrir app / site / pasta | Base pronta | Um alvo por frase; Edge = browser genérico |
| Comandos compostos (Edge + Instagram) | **Falta** | Centro da demo |
| Spotify PKCE + resume/recent | Parcial | **Falta** tocar faixa **pelo nome** |
| Cascata IA (OpenRouter / Ollama) | Base pronta | Hub único; **multi-IA nativa = Fase E** |
| Digitar / teclas / Ctrl allowlist | Já shipped | Útil, mas **não** é Fatia 1 |
| Memória explícita CRUD | Já shipped | Suficiente; “avançada” estacionada |
| Pesquisa web leve | Já shipped | Secundário ao loop |
| Aba ativa do browser | Stub | Extensão inexistente |
| Wake word | Stub UI | Só após Fases A–B |
| Agentes / Atividades / Slack / Jira | Stub UI | **Estacionado** — não é compromisso |

**Veredito:** dá para falar, transcrever, abrir **uma** coisa, retomar Spotify e (se ligar TTS) ouvir a resposta. A demo canônica (“toca [música] + abre Edge e Instagram + Elio fala confirmando”) **ainda não é o que o código entrega**.

---

## Regra de ouro do roadmap

> Não abrir fatia nova de engenharia “interessante” enquanto a **Fase A** não tiver DoD verde.

Exceção só com justificativa explícita no PR: segurança, regressão, ou desbloqueio direto da Fase A.

---

## Fases

### Fase A — Loop demo (PTT) · **agora**

Objetivo: fechar a cena canônica em ~30 s.

| # | Entrega | DoD |
|---|---------|-----|
| A1 | TTS na experiência de voz | Pedido por voz → resposta falada **sem** o usuário caçar o toggle (default on em sessão de voz, ou onboarding que liga na 1ª fala; modo silencioso explícito) |
| A2 | Confirmação falada | Antes/durante ação allowlisted, Elio **fala** o que vai fazer |
| A3 | Spotify por nome de faixa | “Toca [X] no Spotify” → busca + play (Premium); falha falada se sem Premium / sem device |
| A4 | Opens compostos | “Abre o Edge e o Instagram” → dois alvos; aliases claros (`edge` → msedge quando possível) |
| A5 | STT estável pt-BR | Whisper (ou política vigente) entende os pedidos da demo sem “forçar” |

**Saída da Fase A:** gravação/demo em que Douglas só usa voz e completa a cena canônica.

### Fase B — Conversa multi-turno · **depois de A**

| # | Entrega | DoD |
|---|---------|-----|
| B1 | Cumprimento → pergunta → resposta → ação | “Bom dia” abre diálogo curto sem perder o fio |
| B2 | Personalidade curta e estável | Tom consistente em pt-BR; prompts versionados |
| B3 | Contexto da conversa atual | Histórico da sessão suficiente; sem reinventar memória complexa |

**Saída da Fase B:** a demo parece um companheiro, não um router mudo com TTS.

### Fase C — Wake word (opt-in) · **depois de B**

| # | Entrega | DoD |
|---|---------|-----|
| C1 | “Ei, Elio” / “Bom dia, Elio” | Opt-in; privacidade explícita; off por padrão |
| C2 | Transição PTT ↔ wake | Usuário entende o modo ativo; sem escuta surpresa |

**Saída da Fase C:** mãos livres opcionais **sem** sacrificar confiança.

### Fase D — Endurecer o que já existe · **paralelo só se não atrapalhar A–C**

Itens já shipped ou úteis, mas **nunca** no lugar da Fase A:

- Digitar / teclas / Ctrl allowlist (polimento, mais apps)
- Memória explícita (UX, não “memória avançada”)
- Distribuição NSIS / auto-update / (depois) assinatura
- Clima / hora / pesquisa web — manter honestos
- Cascata IA atual (OpenRouter) — estabilidade e erros falados (preparação leve para E, sem multi-provedor ainda)

### Fase E — Roteador multi-IA · **depois de A–B (no mínimo)**

Visão de produto: [`produto.md` → Horizonte multi-IA](./produto.md#horizonte--roteador-multi-ia-não-é-fase-a).  
Hoje só existe o hub OpenRouter + Ollama ([ADR 0011](./ADRs/0011-ai-cascade-byok.md)). Esta fase **expande** para IAs conectadas de verdade.

| # | Entrega | DoD |
|---|---------|-----|
| E1 | Conectar provedores (API oficial / BYOK) | Claude, ChatGPT (OpenAI), Gemini no cofre; UI Integrações deixa de ser stub mentiroso |
| E2 | Cascata de cotas | Pago → grátis do mesmo → próxima IA (pago/grátis) → Ollama → erro falado |
| E3 | Roteamento por pedido | “Faz um site / explica este código” usa IA conectada; label **quem** atendeu |
| E4 | Budget enforce real | Contadores persistidos; estouro detectado (402/429); sem chute |
| E5 | Cursor (quando houver caminho) | Abrir/rotear para Cursor **só** com integração oficial ou fluxo documentado — sem gambiarra de UI |

**Saída da Fase E:** usuário com várias contas (sem assinatura) esgota grátis da IA A e o Elio **sozinho** passa a usar grátis da IA B; com assinatura, preferência paga é óbvia.

**Não fazer na Fase E:** scraping de chat web, login automático em sites, gastar cota sem label, Slack/Jira.

### Fase F — Conectores de produtividade · **depois de A (idealmente A–B)**

Visão e pipeline: [`conectores.md`](./conectores.md).  
Padrão: OAuth oficial + operação allowlisted + confirmação falada + resumo opcional via LLM (cascata atual ou Fase E).

| # | Entrega | DoD |
|---|---------|-----|
| F0 | Contrato de conector + UI Integrações | Interface única (auth, ops, erros); Spotify como referência de PKCE |
| F1 | Outlook leitura | “Últimos e-mails” → lista (de/assunto/hora) + TTS; scope `Mail.Read` |
| F2 | Resumo de e-mails | Mesma lista → LLM resume preview → Elio fala sem inventar |
| F3 | Teams leitura | “Mensagens recentes no Teams” com scope mínimo; mesmo molde |
| F4 | Opens já existentes | Continuam Tipo A; compostos da Fase A não dependem de F |

**Saída da Fase F:** “Como estão meus e-mails?” e “Resume os últimos” funcionam de ponta a ponta com confirmação falada e sem scrapear Outlook.

**Não fazer na Fase F (ainda):** enviar e-mail, apagar, RPA na UI do Outlook/Teams, tool Graph livre para o LLM.

### Estacionado (não fazer agora)

Explicitamente **fora** até o loop A–B estar bom (e, para multi-IA, até a Fase E ser aberta):

| Item | Motivo |
|------|--------|
| Agentes / Atividades / Workspace | Puxam para “plataforma”; conflitam com o norte |
| Slack / Jira | SaaS lateral; não é roteador de LLM |
| Multi-IA nativa (Claude / ChatGPT / Gemini / Cursor) | **Compromisso = Fase E** — zero PRs antes de A–B |
| Outlook / Teams / conectores Graph | **Compromisso = Fase F** — zero PRs antes de A (exceto contrato enxuto se destravar A) |
| Extensão de aba do browser | Lane C honesta; custo alto vs valor no loop |
| RPA genérico / UI automation ampla | Allowlist > poder total |
| Tema claro / i18n / Mac como produto | Fora do ICP atual |
| SQLite | Adiado técnico |

Stubs na UI podem permanecer como “em breve” — **sem** PR de implementação até saírem desta lista por decisão explícita neste roadmap (abrir Fase E = decisão explícita).

---

## Ordem de PRs sugerida (Fase A)

1. **A1 + A2** — voz com voz + confirmação falada (menor fricção perceptível)  
2. **A4** — opens compostos + alias Edge real  
3. **A3** — Spotify search + play por nome  
4. **A5** — só se a demo ainda falhar por STT  

Automação de teclado, extensão, agentes, etc.: **fila atrás**.

---

## Como priorizar um PR

Checklist obrigatório no corpo do PR (mesmo informal):

1. Qual fase (A/B/C/D/**E**/**F**) isto melhora?  
2. Melhora a **demo canônica**? Como?  
3. Introduz risco de segurança (escopo de ação, secrets, rede, dados de e-mail)?  
4. Se for “D”, “E”, “F” ou estacionado: por que agora (e Fase A já está verde)?

Se a resposta a (1) for “nenhuma” e a (2) for “não”, o PR espera.

---

## Métricas de progresso (leves)

Não há analytics de produto ainda. Usar:

- **Demo verde / vermelha** na Fase A (pass/fail manual)  
- Contagem de PRs na Fase A vs fora dela (saúde do foco)  
- Regressões de allowlist / secrets = bloqueio imediato

---

## Histórico de alinhamento

| Data | Mudança |
|------|---------|
| 2026-11-15 | Norte redefinido como companheiro de voz (`produto.md`) |
| 2026-11-16 | Público-alvo, fases A–D, estacionados e DoD (`roadmap.md`); design system subordinado ao norte |
| 2026-11-16 | Horizonte multi-IA (Claude/ChatGPT/Gemini/Cursor) + cascata de cotas grátis = **Fase E** |
| 2026-11-16 | Ações no PC + conectores (Outlook/Teams) = [`conectores.md`](./conectores.md) + **Fase F** |
