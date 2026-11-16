# Análise competitiva — três “Jarvis” no GitHub

**Status:** referência de produto (não ADR)  
**Atualizado:** 2026-11-16  
**Âncora:** [`produto.md`](./produto.md) · [`roadmap.md`](./roadmap.md) · [`conectores.md`](./conectores.md)

Objetivo: extrair o que **agrega ao Elio** sem copiar stack nem virar clone. Em conflito com o norte (companheiro de voz Windows + allowlist), o norte vence.

---

## Mapa rápido

| Repo | Stars (aprox.) | O que é de verdade | Relevância p/ Elio |
|------|----------------|--------------------|--------------------|
| [open-jarvis/OpenJarvis](https://github.com/open-jarvis/OpenJarvis) | ~15,7k | Framework **local-first** de IA pessoal (Stanford) — digest, conectores, skills, agentes | **Alta** — ideias de produto e conectores |
| [jev-chat/jev-chat-jarvis](https://github.com/jev-chat/jev-chat-jarvis) | ~8,4k | **Copiloto de resposta** em chats (WhatsApp etc.): lê tela, julga, sugere, **você** envia | **Média** — padrões de julgamento / HITL / privacidade |
| [zouhir/jarvis](https://github.com/zouhir/jarvis) | ~5,5k | Plugin **webpack-jarvis** — dashboard de build no browser (2017) | **Quase nula** — só colisão de nome |

> O terceiro **não** é um assistente tipo JARVIS. É ferramenta de desenvolvedor Webpack. Não misturar no roadmap de produto.

---

## 1. OpenJarvis — o que tem de bom

### Essência
“Personal AI, on personal devices”: LLM local (Ollama) por padrão, nuvem só quando precisa; presets; conectores OAuth (`jarvis connect`); **morning digest** falado (e-mail, calendário, saúde, notícias); skills; agentes agendados/contínuos; evals de custo/energia.

### Pegar para o Elio

| Ideia | Por que encaixa | Onde no nosso roadmap |
|-------|-----------------|------------------------|
| **Briefing “Bom dia” falado** | Junta voz + Outlook/calendário/clima que já planejamos (Fases A/B/F) | **Fase B+F** — “Bom dia, Elio” → digest curto falado |
| **`connect` unificado** | Um fluxo OAuth por provedor (Gmail/Graph, Spotify…) | **Fase F0** — contrato de conector / Integrações |
| **Presets de experiência** | Setup em minutos (“digest”, “só chat”, “código”) | Depois do loop A — onboarding por cenas |
| **Persona em arquivo** | Tom estável (já queremos em B2) | **Fase B2** |
| **Agendamento / cron** | Digest diário; irmão do “desliga em 10 min” | **Fase D** (energia) + digest agendado pós-F |
| **Local-first + nuvem sob demanda** | Já temos Ollama + cascata; reforça a Fase E | **Fase E** + Ollama |
| **`doctor` / status honesto** | Diagnóstico de mic, STT, conectores, cotas | Fase D leve / UX Integrações |
| **Skills como catálogo opt-in** | Só se for skill **allowlisted** (não shell livre) | Horizonte — **não** virar OpenClaw |

### Não copiar
- Orchestrator / ReAct / CodeAct com **shell e file I/O livres** — conflita com allowlist do Elio.  
- Virar framework de pesquisa ou “8 agentes”.  
- Trocar Electron+TS por Python/Rust só porque eles usam.

---

## 2. Jev Chat Jarvis — o que tem de bom

### Essência
Copiloto de **chat**: lê a conversa na tela (acessibilidade / OCR), **julga** intenção e risco **antes** de escrever, gera 2–3 rascunhos, **checa** contra um “goal”, preenche a caixa — **nunca envia sozinho**. BYOK, sem servidor deles.

### Pegar para o Elio

| Ideia | Por que encaixa | Onde no nosso roadmap |
|-------|-----------------|------------------------|
| **Julgar antes de agir** | Espelha “confirma falando” + gates de segurança | **Fase A2** e ações sensíveis (energia, e-mail) |
| **Hard checks que bloqueiam** | Ex.: prometer demais, fato inventado, ação fora do goal | Resumos de e-mail / Fase E–F (“não invente”) |
| **Human-in-the-loop** | “Você aperta send” ≈ “você confirma o desligamento” | Princípio de produto já existente — reforçar |
| **Dois papéis de modelo** | Um “julga”, outro “escreve” | Fase E — roteamento por tipo de tarefa |
| **Diagnostics sem texto sensível** | Logs com contagens/scores, sem corpo de chat/e-mail | Export / dados / conectores |
| **Fill no input, não auto-enviar** | Já temos digitar no foco; mesmo espírito | Desktop input |
| **Cenas / relacionamento** | Contexto de quem é a pessoa (trabalho, família) | Memória explícita leve (já existe CRUD) |

### Não copiar como núcleo
- Produto centrado em **OCR/a11y de WhatsApp/QQ** — outro ICP; frágil a updates de UI; ToS.  
- Elio prefere **API oficial** (Graph, etc.) para e-mail/Teams ([`conectores.md`](./conectores.md)).  
- OCR de janela de chat no Windows pode ser **experimento futuro**, não Fase A–F.

---

## 3. zouhir/jarvis — o que tem de bom

### Essência
`webpack-jarvis`: UI bonita com métricas de bundle, erros, “search error on Google/SO”. Último push relevante antigo; nome JARVIS é branding.

### Pegar para o Elio
Quase nada de produto. No máximo inspiração visual fraca: painel “Computador” com status claro (já existe snapshot CPU/RAM). **Não** entra no roadmap de companheiro de voz.

---

## Como o Elio fica **mais completo** que cada um sozinho

| Capacidade | OpenJarvis | Jev | zouhir | **Elio (alvo)** |
|------------|:----------:|:---:|:------:|:---------------:|
| Voz → fala → age no **Windows desktop** | Parcial (GUI/CLI) | Não (foco chat) | Não | **Núcleo** |
| Allowlist + confirmação falada | Fraco / agentes livres | Forte HITL em chat | N/A | **Núcleo** |
| PT-BR nativo no dia a dia | Não é o foco | Edição global = EN | N/A | **Núcleo** |
| Spotify / opens / energia PC | Conectores + tools | Não | Não | Já / Fase D |
| Briefing “Bom dia” falado | **Forte** (digest) | Não | Não | **Pegar** (B+F) |
| E-mail/calendário via API | **Forte** | Não (lê tela) | Não | Fase F |
| Cascata multi-IA + cotas | Local→cloud | BYOK OpenRouter | Não | Fase E |
| Copiloto de resposta em chat | Não | **Forte** | Não | Opcional longe |
| Segurança: sem shell livre | Não é o posicionamento | Sim (não envia) | N/A | **Núcleo** |

**Tese:** OpenJarvis ganha em **conectores + digest + local-first**. Jev ganha em **julgamento + HITL + checks**. Elio ganha em **companheiro de voz no Windows que confirma e age com allowlist em pt-BR**. Combinar o melhor dos dois primeiros **em cima** do nosso norte = produto mais completo para o ICP do Douglas do que qualquer um isolado.

---

## Backlog de inspiração (ordenado, sem furar Fase A)

1. **Agora (A):** confirmação falada + TTS no loop (já no roadmap) — alinhar mentalmente ao “judge before act” do Jev.  
2. **B:** personalidade estável + “Bom dia” que **abre** conversa (gancho do digest).  
3. **F0–F2:** `connect` estilo OpenJarvis + Outlook lista/resumo.  
4. **Digest v1:** clima + hora + (se conectado) e-mails/calendário → TTS — “Bom dia, Elio”.  
5. **D:** energia PC + `elio doctor` (mic, STT, conectores, cotas).  
6. **E:** multi-IA; opcionalmente papel “juiz” vs “escritor”.  
7. **Longe / estacionado:** OCR de WhatsApp, skills com shell, agentes contínuos tipo OpenJarvis operative.

---

## Fontes

- OpenJarvis README + [Morning Digest docs](https://open-jarvis.github.io/OpenJarvis/user-guide/morning-digest/)  
- Jev `global/README.md` + `global/ARCHITECTURE.md`  
- zouhir/jarvis README (webpack-jarvis)
