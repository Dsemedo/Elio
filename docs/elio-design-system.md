# ELIO — Design System & UI Specification

**Versão:** 1.1 (MVP-scoped)  
**Status:** Fonte viva da verdade de UI · crítica Douglas incorporada (2026-11-15)  
**Produto:** ELIO — AI Desktop Assistant  
**Plataforma inicial:** Windows 10/11  
**Changelog:** [ds-mvp-changelog.md](./ds-mvp-changelog.md)

Este documento é a **fonte viva** do design system. Em conflito com notas soltas, vale este arquivo (escopo MVP da v1.1).

---

# 0. Escopo MVP vs depois

| Camada / feature | MVP (Fase 1) | Depois (Estágio 2+) |
|---|---|---|
| Floating Bar (anatomia + estados reais) | Sim | — |
| Command Center: chat, histórico, config básica | Sim (restyle leve) | Polimento |
| Sidebar: Início, Conversas, Configurações | Sim | — |
| **Atividades** (trilha profunda) | Stub / “em breve” | Real |
| **Agentes** | Stub / “em breve” | Real |
| **Memória** avançada | Stub / “em breve” | Real |
| **Workspace** completo | Fora | Real |
| Estados **EXECUTING** / **AWAITING_APPROVAL** | Não fingir na UI | Quando o Core tiver ações |
| SPEAKING (TTS visual rico) | Opcional leve / futuro | Completo |

UI pode mostrar entradas como **“em breve”** — honestas, sem simular fluxos que o núcleo ainda não executa.

---

# 1. Visão do produto

O ELIO é um assistente de inteligência artificial para desktop, projetado para acompanhar o usuário durante suas atividades profissionais e pessoais.

A interface deve transmitir inteligência, simplicidade, sofisticação e confiança.

O objetivo não é criar apenas uma interface de chatbot, mas uma experiência de assistente pessoal que esteja sempre acessível, consiga executar tarefas e permita acompanhar suas atividades sem interromper o fluxo de trabalho.

A experiência será organizada em três níveis:

1. **Floating Bar:** interface compacta e flutuante, sempre acessível. **(MVP)**
2. **Command Center:** ambiente principal de conversação e acompanhamento. **(MVP — base)**
3. **Workspace:** gerenciamento completo de agentes, memória, provedores e configurações. **(Estágio 2 — depois)**

# 2. Identidade visual

## 2.1 Personalidade

A direção visual será HÍBRIDA:

- Minimalista e elegante quando ocioso.
- Tecnológica e sofisticada durante interações.
- Animações sutis quando estiver ouvindo, processando ou executando tarefas.
- Visual premium, sem exageros futuristas.
- Interface intuitiva, com baixa curva de aprendizado.

Referências conceituais: Raycast, Linear, Arc e interfaces modernas de assistentes de IA.

Não copiar diretamente nenhuma dessas referências. Utilizá-las apenas como inspiração de qualidade visual e experiência.

## 2.2 Paleta de cores

Tema padrão: **Dark only no MVP** (tema claro = depois).

| Token | Cor | Uso |
|---|---|---|
| Background | #101216 | Fundo de janela |
| Surface | #191D24 | Superfícies base |
| Surface Elevated | #252B34 | Elevação / painéis |
| Border | #303742 | Bordas discretas |
| Text Primary | #F4F5F7 | Texto principal |
| Text Secondary | #929BA8 | Texto auxiliar |
| Accent | #72D9C0 | Identidade; voz; ativo |
| Warning | #E9BD73 | Atenção / aprovação futura |
| Error | #E78383 | Erros e falhas |
| Info | #A995ED | **Só badges de IA** — não “processando” |

### Regras de uso de cor (obrigatório)

- **Accent (teal `#72D9C0`):** voz ativa, estados de escuta/transcrição, controles ativos, identidade do produto.
- **Thinking / processando chat:** **neutro** — spinner ou surface elevada; **não** roxo; **não** competir com o accent.
- **Info / roxo (`#A995ED`):** exclusivo para **badges de IA** (ex.: “IA”, modelo). Não usar como cor de “processando”.
- **Warning / Error:** só estados semânticos reais.
- Sem gradientes excessivos, brilhos exagerados ou neon.

## 2.3 Tipografia

- **Família primária:** **Geist Sans** (fallback: `system-ui`, `sans-serif`).
- Inter **não** é a escolha do DS v1.1.
- Pesos: títulos 600 · textos 400 · botões/labels 500.
- **Escala fixa (px):** `12` / `13` / `14` / `16` / `20`.
  - 12–13: labels, auxiliar, meta.
  - 14: corpo padrão (barra, chat).
  - 16: ênfase leve / títulos de seção.
  - 20: títulos de página no Command Center.

## 2.4 Componentes visuais (tokens gerais)

- Ícones Lucide.
- Bordas discretas; cantos arredondados; sombras suaves.
- Transparência / vidro só onde fizer sentido (Floating Bar).
- Ver §2.5 Motion e §2.6 Acessibilidade.

## 2.5 Motion

| Propriedade | Valor |
|---|---|
| Duração | **150–250 ms** |
| Easing | **ease-out** |
| Preferência | Respeitar `prefers-reduced-motion` (Windows) |

**O que anima no MVP:**

- Aparição / hide da Floating Bar.
- Transição de estado da barra (idle → listening → thinking, etc.).
- Expand / collapse para o Command Center.
- Troca de seção na sidebar.
- Entrada leve de MessageBubble.
- Spinner / pulse neutro em thinking (sem flash de cor).

Com reduced motion: trocas instantâneas ou opacidade mínima; sem pulse contínuo.

## 2.6 Acessibilidade (MVP)

- **Dark-only** no MVP — contraste texto/fundo deve passar WCAG AA nos tokens acima.
- **Focus ring** visível obrigatório em controles focáveis (input, botões, nav).
- Não depender só de cor para estado (ícone + label quando possível).
- Click na barra pode focar o input (§3.5); atalho global de foco = **OD-20** (aberto).

# 3. Floating Bar

## 3.1 Conceito

A Floating Bar é o principal elemento de identidade e interação cotidiana do ELIO.

Posicionada no centro superior da tela, sobre outras janelas, sem prejudicar o uso dos demais aplicativos.

Funciona como interface independente do Command Center.

## 3.2 Dimensões (alvo)

| Propriedade | Valor |
|---|---|
| Largura padrão | **420 px** |
| Largura mínima | 340 px |
| Largura máxima | 560 px |
| Altura padrão | **58 px** |
| Posição horizontal | Centralizada |
| Distância superior | 12 px |
| Border radius | 18 px |
| Borda | 1 px |
| Fundo | Grafite translúcido |

Adaptável a DPI / resolução.

## 3.3 Densidade e anatomia (prioridade)

**Prioridade visual:** **input + voz no centro**. Logo menor. Menu em overflow.

Ordem sugerida (esquerda → direita):

1. **Logo** — compacto (não competir com o input).
2. **ChatInput** — ocupa o espaço principal.
3. **Voz** (PTT) — ao lado do input, destaque accent quando ativo.
4. **Expand** — abre/fecha Command Center.
5. **Overflow / menu** — opções secundárias (não ícones soltos competindo).

O campo de texto deve permitir enviar solicitações sem abrir o Command Center.

Manter o alvo **420×58** — densidade alta, sem empilhar controles.

## 3.4 Comportamentos

- Inicializar automaticamente conforme preferência.
- Permanecer acessível sobre outras janelas (detalhes always-on-top / hide = OD-20).
- Arrastar e reposicionar.
- Ocultar / reabrir por atalho global (**OD-20** — aberto).
- Não roubar foco de outros apps **indevidamente**.
- Preservar contexto ao abrir o Command Center.
- Interromper respostas/tarefas quando aplicável.

## 3.5 Foco (regras)

| Ação | Política |
|---|---|
| Clique na barra / no input | **OK focar** o ChatInput |
| Atalho global (trazer barra) | **TBD — OD-20** (não decidir foco aqui) |
| App em segundo plano | Não roubar foco sem intenção do usuário |

# 4. Estados da Floating Bar

A UI reflete o estado **real** do assistente. Não inventar execução/aprovação se o Core ainda não faz essas ações.

| Estado | Quando | Visual |
|---|---|---|
| IDLE | Pronto | Neutro, grafite, accent discreto |
| LISTENING | Mic gravando (PTT) | **Accent**; indicador de áudio |
| TRANSCRIBING | Whisper processando | **Accent** sutil |
| THINKING | Chat aguardando modelo | **Neutro** (spinner / surface) — **não** roxo |
| SPEAKING | TTS ativo (futuro) | Accent pulsante leve |
| EXECUTING | Tool/ação no PC | **Estágio 2** — não fingir |
| AWAITING_APPROVAL | Ação sensível pendente | **Estágio 2** — Warning quando existir |
| ERROR | Falha real | Error |
| OFFLINE | Sem provedor utilizável | Text secondary + aviso |

# 5. Command Center

Ambiente principal ao expandir a Floating Bar.

## 5.1 Estrutura

- Janela independente (shell Electron).
- Sidebar esquerda + conteúdo à direita.

## 5.2 Navegação (sidebar)

| Item | MVP | Depois |
|---|---|---|
| Início | Resumo / status | — |
| Conversas | Chat + histórico | Polimento |
| Atividades | Stub **“em breve”** | Trilha real |
| Agentes | Stub **“em breve”** | Workspace / agentes |
| Memória | Stub **“em breve”** | Memória explícita rica |
| Configurações | Provedores, PC, prefs | — |

## 5.3 Visual

- Tokens §2.2; tipografia Geist Sans + escala §2.3.
- Sem cards desnecessários; hierarquia clara.
- Motion 150–250 ms ease-out nas trocas de seção.

# 6. Workspace

Camada **Estágio 2** para agentes, memória avançada, provedores profundos e configurações avançadas. **Fora da Fase 1.** Sidebar reserva stubs honestos (“em breve”).

# 7. Tokens de implementação (CSS)

```css
--elio-bg: #101216;
--elio-surface: #191D24;
--elio-surface-elevated: #252B34;
--elio-border: #303742;
--elio-text: #F4F5F7;
--elio-text-secondary: #929BA8;
--elio-accent: #72D9C0;
--elio-warning: #E9BD73;
--elio-error: #E78383;
--elio-info: #A995ED; /* só badges de IA */
--elio-radius-bar: 18px;
--elio-motion: 200ms;
--elio-motion-ease: ease-out;
--elio-font: "Geist Sans", system-ui, sans-serif;
--elio-type-xs: 12px;
--elio-type-sm: 13px;
--elio-type-md: 14px;
--elio-type-lg: 16px;
--elio-type-xl: 20px;
--elio-focus-ring: 0 0 0 2px var(--elio-bg), 0 0 0 4px var(--elio-accent);
```

# 8. Componentes — só Fase 1

Escopo fechado do DS para implementação imediata (+ tokens §7):

| Componente | Papel |
|---|---|
| **FloatingBar** | Shell da barra 420×58; anatomia §3.3 |
| **ChatInput** | Campo de texto (barra e/ou CC) |
| **StatusIndicator** | Estados reais §4 (incl. thinking neutro) |
| **MessageBubble** | Bolhas de chat com tokens |
| **Sidebar** | Nav do Command Center (+ stubs “em breve”) |

Fora da Fase 1 (não especificar/implementar agora como DS): Workspace, deep Atividades, fluxos de aprovação, orchestrator UI, etc.

# 9. Arquitetura UI / Core

Alinhado ao shell atual (Electron + React):

```text
┌─────────────────┐     ┌──────────────────────┐
│  Floating Bar   │     │   Command Center     │
│  (BrowserWindow)│     │   (BrowserWindow)    │
└────────┬────────┘     └──────────┬───────────┘
         │                         │
         └──────────┬──────────────┘
                    │
         ┌──────────▼──────────┐
         │  UI State Manager   │  ← sincroniza Bar ↔ CC
         └──────────┬──────────┘
                    │ IPC tipado (Zod)
         ┌──────────▼──────────┐
         │  Electron Main      │
         │  Conversation / AI  │
         │  Voice / Config / … │
         └─────────────────────┘
```

Regras:

- **UI (React) ≠ regras de negócio de IA.** Renderer só apresenta e dispara intenções via IPC.
- **IPC:** `contextBridge` + schemas **Zod** em todo canal.
- **UI State Manager** entre janelas Bar e Command Center (estado compartilhado de UI: foco, conversa ativa, status visual).
- **Core ainda não tem agent orchestrator** — por isso Agentes / EXECUTING / approval ficam Estágio 2; UI não simula.
- Não reescrever arquitetura Electron nem AI Core “por causa do visual”.

# 10. Requisitos Windows

- DPI / multi-monitor: CSS px + BrowserWindow em dip.
- Transparência da barra: grafite translúcido (`rgba` + `transparent: true`).
- Bandeja / foco: shell Fatia A; atalho global = **OD-20**.

# 11. Segurança

- `contextIsolation`, sem `nodeIntegration`, sandbox, Zod IPC.
- Sem secrets na UI; logs sem conteúdo de mensagem.

# 12. Critérios de aceite (Fase 1)

1. Tokens da paleta + tipografia **Geist Sans** + escala 12/13/14/16/20 na Floating Bar e no Command Center.
2. Barra **420×58** (± DPI), radius 18, 12 px do topo, centralizada; densidade: input+voz centro, logo menor, menu overflow.
3. Componentes Fase 1 apenas: FloatingBar, ChatInput, StatusIndicator, MessageBubble, Sidebar (+ tokens).
4. Estados reais: idle, listening, transcribing, thinking (**neutro**), error, offline — sem fingir EXECUTING / AWAITING_APPROVAL.
5. Accent = voz/ativo; Info roxo = só badges de IA.
6. Focus ring + contraste no dark-only MVP; click na barra foca input; hotkey global = OD-20.
7. Motion 150–250 ms ease-out; `prefers-reduced-motion`.
8. Sidebar com stubs “em breve” onde for Estágio 2; chat/voz/histórico intactos.

# 13. Fases

| Fase | Conteúdo |
|---|---|
| **1 (MVP)** | Tokens + FloatingBar + ChatInput + StatusIndicator + MessageBubble + Sidebar; estados reais; restyle leve do CC |
| **2** | Command Center completo (Início, Conversas polidas, Configurações) |
| **3** | Atividades / Agentes / Memória reais + Workspace |
| **4** | SPEAKING (TTS), EXECUTING / approval (quando Core tiver), polish multi-monitor |

# 14. Fora de escopo imediato

- OAuth Slack/Jira, perfilamento profundo de PC, abrir apps via Ollama, atalho global (OD-20).
- Agent orchestrator na UI; Workspace full; tema claro.

---

**Relacionados:** [ui-direction.md](./ui-direction.md) · [shell-product-brief.md](./shell-product-brief.md) · [architecture.md](./architecture.md) · [decision-log.md](./decision-log.md) · [open-decisions.md](./open-decisions.md) (OD-20)
