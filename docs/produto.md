# Elio — documento de produto

**Status:** vigente  
**Atualizado:** 2026-11-15  
**Público:** qualquer pessoa que for construir, priorizar ou falar sobre o Elio

Este é o **norte do produto**. Em conflito com roadmap antigo, fatias de PR ou notas soltas, vale este documento.

---

## O que é o Elio

O Elio é um **companheiro de voz no desktop Windows**: você fala, ele responde **com som**, confirma o que vai fazer e **age no PC** — abrir apps, sites, Spotify, tarefas do dia a dia — com limites claros de segurança.

Não é um chat genérico com atalhos.  
Não é um painel de configurações com microfone.  
É o loop:

> **ouvir → responder com voz → confirmar → agir → falar o resultado**

---

## Para que foi criado

Douglas quer um assistente próximo do uso real:

1. “Bom dia, Elio” → ele responde “Bom dia, como você está?” **com voz**
2. “Estou bem — toca [música] no Spotify” → “Estou colocando agora” → Spotify toca
3. “Abre o Edge e o Instagram” → confirma e abre

A motivação é **reduzir fricção**: menos digitar, menos caçar janelas, mais conversa curta que vira ação. O PC continua sob controle do usuário (confirmações, allowlist, sem RPA cego).

---

## Frase-norte

> **Elio escuta, responde com voz, confirma e age no PC — com allowlist.**

Tudo que entrarmos no roadmap precisa servir a essa frase. Se não servir, é depois (ou não é Elio).

---

## Experiência-alvo (demo que importa)

| Passo | O que acontece |
|-------|----------------|
| 1 | Você fala (hoje: segurar o mic; depois: wake word opcional) |
| 2 | Elio **fala** uma resposta curta em pt-BR |
| 3 | Você pede uma ação (Spotify, Edge, Instagram, pasta…) |
| 4 | Elio **confirma falando** (“Estou abrindo…”, “Colocando no Spotify…”) |
| 5 | A ação executa de verdade no Windows |
| 6 | Elio **fala o resultado** se precisar (ok / falhou / precisa Premium) |

Se esse loop não funcionar de ponta a ponta, o restante (memória, distribuição, digitar no app, pesquisa web) é secundário.

---

## O que o Elio é — e o que não é

| É | Não é |
|---|--------|
| Companheiro por voz no Windows | Clone do Kobi ou de assistentes cloud |
| Conversa curta + ação | Só router de intents sem personalidade |
| TTS ligado na experiência de voz | App mudo com texto na barra |
| Opens e APIs com allowlist | Shell/`exec` arbitrário |
| Privacidade local quando possível | Escuta contínua obrigatória |
| Produto pessoal em evolução | Kit de fatias de engenharia sem demo |

---

## Prioridades de construção

Ordem fixa. Não pular etapas para “features interessantes”.

### Fatia 1 — Loop demo (PTT)

- TTS **ligado** nas respostas vindas de voz  
- Confirmação falada antes/durante a ação  
- Spotify: tocar **faixa pelo nome** (não só retomar)  
- Comandos compostos: Edge + Instagram (e aliases claros)  
- STT Whisper local (primário Win/Mac); Windows Speech só opcional via env

### Fatia 2 — Conversa multi-turno

- “Bom dia” → pergunta de volta → você responde → ele age  
- Personalidade curta e estável  
- Contexto da conversa atual sem reinventar memória complexa

### Fatia 3 — Wake word (opcional)

- “Ei, Elio” / “Bom dia, Elio”  
- Opt-in, com privacidade explícita  
- Só depois do loop 1–2 estar bom de verdade

### Depois (só se servir ao loop)

- Digitar / teclas no app em foco  
- Extensão de aba do browser  
- Memória explícita mais rica  
- Distribuição / auto-update  
- Automação mais profunda (sempre allowlisted)

---

## Princípios de decisão

1. **Demo primeiro.** Se não dá para mostrar o loop em 30 segundos, a fatia está errada.  
2. **Voz com voz.** Pedido por voz merece resposta falada (salvo modo silencioso explícito).  
3. **Confirmar e agir.** Ação sem confirmação falada parece bug; confirmação sem ação parece mentira.  
4. **Allowlist > poder total.** Preferimos menos ações confiáveis a RPA genérico frágil.  
5. **PT-BR real.** STT/TTS e intents pensados para português do dia a dia.  
6. **Um norte.** ADRs descrevem *como*; este doc descreve *para quê*. Em dúvida de prioridade, este doc vence.

---

## Estado atual (honesto)

Em **v0.17.x** já existem pedaços: Floating Bar, Whisper STT, TTS (off por padrão), opens, Spotify PKCE parcial, clima, cascata de IA, digitar no app e atalhos allowlisted (Ctrl+C/V/A/Z/X/S).

O desalinhamento recente: muitas fatias de engenharia **sem** o loop de companheiro como centro. A partir deste documento, o roadmap gira em torno do loop acima.

Detalhe técnico (ADRs, design system, distribuição): pasta [`docs/ADRs/`](./ADRs/), [`elio-design-system.md`](./elio-design-system.md), [`windows-distribution.md`](./windows-distribution.md).

---

## Como usar este documento

- **Antes de um PR:** “Isso melhora a Fatia 1, 2 ou 3?” Se não, justificar ou adiar.  
- **Na dúvida de UX:** preferir o caminho que deixa o Elio **falar e agir**.  
- **README / marketing curto:** apontar para cá; não duplicar roadmap técnico no README.
