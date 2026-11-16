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
| Cascata IA (OpenRouter / Ollama) | Base pronta | BYOK |
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
- Cascata IA — estabilidade e erros falados

### Estacionado (não fazer agora)

Explicitamente **fora** até o loop A–B estar bom:

| Item | Motivo |
|------|--------|
| Agentes / Atividades / Workspace | Puxam para “plataforma”; conflitam com o norte |
| Slack, Jira, ChatGPT/Gemini “direto” na UI | Integração SaaS sem servir a demo |
| Extensão de aba do browser | Lane C honesta; custo alto vs valor no loop |
| RPA genérico / UI automation ampla | Allowlist > poder total |
| Tema claro / i18n / Mac como produto | Fora do ICP atual |
| Budget IA enforce / SQLite | Adiados técnicos; não são produto |

Stubs na UI podem permanecer como “em breve” — **sem** PR de implementação até saírem desta lista por decisão explícita neste roadmap.

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

1. Qual fase (A/B/C/D) isto melhora?  
2. Melhora a **demo canônica**? Como?  
3. Introduz risco de segurança (escopo de ação, secrets, rede)?  
4. Se for “D” ou estacionado: por que agora?

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
