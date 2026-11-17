# Elio — documento de produto

**Status:** vigente  
**Atualizado:** 2026-11-16 (roteador multi-IA no horizonte)  
**Versão do produto referenciada:** v0.17.x  
**Público:** quem for construir, priorizar, desenhar ou falar sobre o Elio

Este é o **norte do produto**. Em conflito com roadmap antigo, fatias de PR, design system ou notas soltas, **vale este documento** para *o quê* e *para quem*. O *quando* está em [`roadmap.md`](./roadmap.md). O *como* técnico está nas [`ADRs`](./ADRs/).

---

## Frase-norte

> **Elio escuta, responde com voz, confirma e age no PC — com allowlist.**

Tudo que entra no roadmap precisa servir a essa frase. Se não servir, é depois — ou não é Elio.

---

## O que é o Elio

O Elio é um **companheiro de voz no desktop Windows**: você fala, ele responde **com som**, confirma o que vai fazer e **age no PC** — abrir apps, sites, Spotify, tarefas do dia a dia — com limites claros de segurança.

Não é um chat genérico com atalhos.  
Não é um painel de configurações com microfone.  
Não é uma plataforma de agentes / workspace corporativo.

É o loop:

> **ouvir → responder com voz → confirmar → agir → falar o resultado**

---

## Para que existe

Motivo raiz: **reduzir fricção** no PC do dia a dia — menos digitar, menos caçar janelas, mais conversa curta que vira ação — sem entregar o controle do sistema a um RPA cego.

Cena canônica (a demo que importa):

1. “Bom dia, Elio” → ele responde com voz: “Bom dia, como você está?”
2. “Estou bem — toca [música] no Spotify” → “Estou colocando agora” → a música toca
3. “Abre o Edge e o Instagram” → confirma falando e abre os dois

Se esse loop não fecha ponta a ponta, o restante é secundário.

---

## Público-alvo

### Primário (agora) — dogfooding

| Campo | Definição |
|-------|-----------|
| Quem | **Douglas Semedo Neto** — criador e único usuário diário do produto |
| Contexto | Windows 10/11, pt-BR, uso pessoal + trabalho no PC |
| Trabalho a fazer | Falar com o PC e ver ação real (música, apps, sites) sem abrir menus |
| Critério de sucesso | Usa o Elio sozinho, sem “forçar a demo”, pelo menos uma vez por dia |

O Elio é, nesta fase, um **produto pessoal em evolução**. Não há go-to-market, pricing nem onboarding multi-usuário. Toda priorização serve primeiro a esse dogfooding.

### Secundário (só depois do loop estável) — ICP

Pessoas que se parecerem com Douglas e possam instalar um `.exe` Windows:

- Falam **português do Brasil** no dia a dia
- Usam **Windows** como máquina principal
- Querem **voz → ação** (Spotify, browser, apps), não um segundo ChatGPT na barra
- Aceitam **limites explícitos** (allowlist, confirmação) em troca de previsibilidade e privacidade
- Preferem **local quando possível** (Whisper, Ollama) e, no horizonte, **várias IAs conectadas** com cascata de cotas (Fase E)

### Não é público (agora)

| Perfil | Por quê fora |
|--------|----------------|
| Times / empresas que querem “workspace de agentes” | Fora do norte; stubs de Agentes/Atividades são honestos “em breve”, não roadmap ativo |
| Usuários Mac/Linux como alvo de produto | Pode rodar em dev; **produto** é Windows first |
| Quem busca RPA genérico / automação de qualquer app | Allowlist > poder total |
| Quem quer só chat de texto com LLM | Existem produtos melhores; Elio sem voz+ação não se justifica |
| Crianças / uso sem supervisão de ações no SO | Ações reais no desktop exigem usuário adulto consciente |

---

## Posicionamento

| Dimensão | Elio |
|----------|------|
| Categoria | Companheiro de voz no desktop |
| Plataforma | Windows 10/11 (x64) |
| Idioma | PT-BR nativo (STT, TTS, intents) |
| Diferencial | Conversa curta + **ação allowlisted** + resposta falada |
| Privacidade | Local quando possível; secrets no cofre do SO; sem escuta contínua obrigatória |
| Estágio | Produto pessoal → eventual compartilhamento controlado (releases) |

**Uma frase de posicionamento:**  
*O Elio é o companheiro que fala com você no Windows e faz o que você pediu — com confirmação e allowlist — em português do Brasil.*

---

## Experiência-alvo (demo)

| Passo | O que acontece |
|-------|----------------|
| 1 | Você fala (hoje: segurar o mic / PTT; depois: wake word opcional) |
| 2 | Elio **fala** uma resposta curta em pt-BR |
| 3 | Você pede uma ação (Spotify, Edge, Instagram, pasta…) |
| 4 | Elio **confirma falando** (“Estou abrindo…”, “Colocando no Spotify…”) |
| 5 | A ação executa de verdade no Windows |
| 6 | Elio **fala o resultado** se precisar (ok / falhou / precisa Premium) |

---

## O que o Elio é — e o que não é

| É | Não é |
|---|--------|
| Companheiro por voz no Windows | Clone de Copilot / Alexa / “AI workspace” |
| Conversa curta + ação | Só router de intents sem personalidade |
| TTS ligado na experiência de voz | App mudo com texto na barra |
| Opens e APIs com allowlist | Shell/`exec` arbitrário ou RPA cego |
| Privacidade local quando possível | Escuta contínua obrigatória |
| Produto pessoal com demo clara | Kit de fatias de engenharia sem demo |
| Floating Bar voz-first | Dashboard de agentes / atividades / Jira |

---

## Princípios de decisão

1. **Demo primeiro.** Se não dá para mostrar o loop em ~30 s, a fatia está errada.  
2. **Voz com voz.** Pedido por voz merece resposta falada (salvo modo silencioso explícito).  
3. **Confirmar e agir.** Ação sem confirmação falada parece bug; confirmação sem ação parece mentira.  
4. **Allowlist > poder total.** Menos ações confiáveis > RPA genérico frágil.  
5. **PT-BR real.** STT/TTS e intents para português do dia a dia.  
6. **Um norte.** Este doc descreve *para quê* e *para quem*; ADRs descrevem *como*; [`roadmap.md`](./roadmap.md) descreve *quando*. Em dúvida de prioridade, **este doc vence**.  
7. **Dogfood > feature.** Se Douglas não sente valor no dia a dia, não shipamos “plataforma”.  
8. **IA conectada, não IA escondida.** Quando o Elio usar Claude, ChatGPT, Gemini, Cursor etc., o usuário **vê qual** atendeu — e a cascata de cotas é previsível (abaixo).

---

## Estado atual (honesto)

Em **v0.18.x** já existem pedaços: Floating Bar, Whisper STT, TTS (off por padrão), opens (site no Chrome/Edge, compostos, Maps, site dinâmico com correção de STT), Spotify PKCE + play por nome, clima, cascata de IA, digitar no app e atalhos allowlisted (Ctrl+C/V/A/Z/X/S). O que ainda falta na Fatia 1 é sobretudo **TTS ligado no pedido por voz** e confirmação falada pré-ação.

---

## Horizonte — roteador multi-IA (não é Fase A)

Isto **não** compete com o loop demo agora. É o futuro desejado depois que o companheiro de voz estiver sólido. Detalhe de ordem: **Fase E** em [`roadmap.md`](./roadmap.md). Base técnica atual: cascata OpenRouter → free → Ollama ([ADR 0011](./ADRs/0011-ai-cascade-byok.md)).

### Experiência desejada

1. A pessoa **conecta** no Elio as IAs que usa (ex.: Claude, ChatGPT, Gemini, Cursor — quando houver caminho oficial).  
2. Pede algo ao Elio em voz ou texto: código, “faz um site com IA”, dúvida, etc.  
3. O Elio **direciona** o pedido para uma IA conectada adequada (não obriga a pessoa a abrir outro app e copiar o prompt).  
4. Se ela tem **assinatura / cota paga** naquela IA → usa essa cota.  
5. Se **não** tem assinatura, mas tem conta / chave com **tokens grátis** → o Elio gasta essa cota grátis até esgotar.  
6. Quando a cota grátis **estoura**, o Elio **passa automaticamente** para a próxima IA conectada que ainda tenha cota grátis (ou paga, se existir).  
7. Se nenhuma IA restar → fallback local (Ollama) ou resposta falada honesta: “suas cotas acabaram”.

### Política de cascata (produto)

```text
assinatura/pago da IA preferida
  → cota grátis da mesma IA
    → próxima IA conectada (pago, senão grátis)
      → … até esgotar a fila
        → Ollama local (se ligado)
          → erro falado (sem inventar resposta)
```

Preferência de provedor pode seguir: pedido explícito do usuário (“usa o Claude”) → tipo de tarefa (código vs prosa) → ordem configurada nas Integrações.

### O que isso **não** é

| Não é | Por quê |
|-------|---------|
| O Elio “ser” o ChatGPT | Ele **roteia** e fala/age; a IA conectada gera quando precisar de LLM |
| Scraping / login fantasma em sites de chat | Só **APIs oficiais** ou fluxos que a plataforma permitir (ToS + segurança) |
| Gastar tokens **sem** o usuário saber | Sempre mostrar/servir label: quem atendeu (ex.: “Claude · cota grátis”) |
| Substituir a Fase A | Sem loop voz+ação, multi-IA é chat genérico com cascata |

### Segurança (obrigatório neste horizonte)

- Chaves e tokens só no **cofre** do SO (`safeStorage`); nunca no renderer, logs ou export sem redaction.  
- Cascata só entre provedores que o usuário **conectou** de propósito.  
- Sem compartilhar a mesma chave entre processos não confiáveis.  
- Respeitar ToS e limites de cada provedor; esgotamento = 402/429 (ou sinal oficial), não chute.

---

## Horizonte — ações no PC e conectores (Outlook, Teams, …)

O Elio **já** deve agir no PC (abrir site, app, Spotify). No futuro, a mesma ideia vale para **apps com conta**: e-mail, Teams, etc.

**Como (resumo):** não scrapear a tela do Outlook. Usar **API oficial** (Microsoft Graph) + operação na **allowlist** + confirmação falada + (opcional) resumo pela IA conectada.

**Energia do PC:** “desliga” / “desliga em 10 minutos” / “cancela o desligamento” é **possível** no Windows via `shutdown.exe` allowlisted + confirmação obrigatória — ver [`conectores.md`](./conectores.md) § A2 (Fase D, depois do loop demo).

Exemplo: “Quais foram os últimos e-mails?” → OAuth Outlook → Graph traz 5 mensagens → lista na UI → se pediu resumo, LLM resume de/assunto/preview → Elio **fala** “Esse foi da Ana: ela pediu o relatório…”.

Arquitetura completa, anti-padrões e checklist de segurança: **[`conectores.md`](./conectores.md)**. Ordem de build: **Fase F** em [`roadmap.md`](./roadmap.md).

Isto **não** substitui a Fase A (loop demo). Sem voz+ação básica, conector de e-mail vira só mais um painel.

---

## Critérios de sucesso

### Agora (produto pessoal)

- Loop demo fecha em **uma sessão contínua** sem “ligar TTS na mão” como passo secreto.
- Douglas consegue: cumprimentar → pedir música por nome → abrir ≥2 alvos compostos — **só por voz**.
- Zero regressão de segurança: allowlist, sem `exec` arbitrário, secrets fora de logs.

### Depois (se compartilhar)

- Instalador Windows usável (SmartScreen documentado ou assinatura).
- Onboarding mínimo: mic + “Falar respostas” + Spotify opcional.
- Uma pessoa fora do círculo íntimo completa a demo sem ajuda síncrona.

---

## Hierarquia de documentos

| Doc | Decide |
|-----|--------|
| **[`produto.md`](./produto.md)** (este) | O quê, para quem, o que não é, princípios |
| **[`roadmap.md`](./roadmap.md)** | Ordem, fases, DoD, o que está estacionado |
| **[`conectores.md`](./conectores.md)** | Como agir no PC e em apps (Outlook, Teams, …) |
| **[`analise-jarvis.md`](./analise-jarvis.md)** | O que aprender de OpenJarvis / Jev (e o que ignorar) |
| **[`melhoria-latencia-voz-pos-kobi.md`](./melhoria-latencia-voz-pos-kobi.md)** | Latência voz/STT pós-Kobi — tirar Whisper do caminho crítico da demo |
| **[`ADRs/`](./ADRs/)** | Como implementar decisões técnicas |
| **[`elio-design-system.md`](./elio-design-system.md)** | UI visual — **subordinado** ao norte de produto |
| **[`windows-distribution.md`](./windows-distribution.md)** | Instalador / update / assinatura |

UI stubs (“Agentes”, “Atividades”, Slack/Jira) **não** criam compromisso de roadmap. São honestidade de interface, não visão futura aprovada.

---

## Como usar este documento

- **Antes de um PR:** “Isso melhora a Fase A, B ou C do roadmap?” Se não, justificar ou adiar.  
- **Na dúvida de UX:** preferir o caminho que deixa o Elio **falar e agir**.  
- **README / marketing curto:** apontar para cá; não duplicar roadmap no README.  
- **Design system / sidebar:** se conflitar com a frase-norte, o design system cede.
