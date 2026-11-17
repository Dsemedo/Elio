# Elio — melhoria de latência de voz (pós-Kobi)

**Status:** guia de engenharia (não ADR)  
**Atualizado:** 2026-11-17 (America/Sao_Paulo)  
**Âncora:** [`produto.md`](./produto.md) · [`roadmap.md`](./roadmap.md) · ADR 0002 · 0005 · 0008 · 0011  
**Referência externa:** [Kobi](https://hiagorzandonadi.github.io/kobi/) (produto comercial “companheiro no entalho”)

Objetivo: fechar o loop que importa no dogfooding — **“oi, tudo bem?”** e **“abre o Google Chrome”** em **~1–3 s** — sem depender do Whisper como caminho crítico. Geração de imagem/site na nuvem **pode demorar**; isso está fora do problema.

Em conflito com Fase E (multi-IA) ou conectores: **Fase A / este guia vencem** até a checklist §7 estar verde.

---

## Veredito

Dá para ficar rápido. O Elio **já tem** o roteador de intents ([ADR 0005](./ADRs/0005-desktop-opens-intent-router.md)). O que está matando a sensação de companheiro é:

1. **Whisper-first** ([ADR 0008](./ADRs/0008-windows-speech-primary-stt.md) revisado + [ADR 0002](./ADRs/0002-whisper-subprocess.md)): cold start, spawn por fala, `small` manglando PT-BR.
2. **Cascata de chat** ([ADR 0011](./ADRs/0011-ai-cascade-byok.md)): BYOK → free → Ollama prioriza **cota**, não **latência** — “oi, tudo bem?” pode ir à nuvem à toa.
3. **TTS off por padrão** (Fase A1 no roadmap): mesmo com STT bom, a demo “não fala”.

---

## O que é “rápido” neste documento

Do **fim da fala** (soltar o PTT) até:

- a **ação começar** (Chrome abrindo), ou  
- o **TTS emitir o primeiro som**

**Meta: ~1–3 segundos.**

Não é “Whisper em 200 ms” isolado — é o pipeline inteiro.

| Pedido | Lane (hoje) | O que deve rodar | Meta |
|--------|-------------|------------------|------|
| abre o Google Chrome | `pc_action` | intent → open allowlist | ≤2 s fim a fim |
| oi, tudo bem? | `chat` (ideal: small-talk) | resposta curta + TTS | ≤3 s até falar |
| gera uma imagem / um site | chat → cloud | classificar barato → IA conectada | classificar &lt;0,2 s; gerar pode demorar |

“Rápido” e “lento” **não** são no mesmo pedido: o classificador escolhe a lane; só a lane pesada demora.

---

## Orçamento de latência (caminho feliz)

| Etapa | Orçamento | Nota no Elio hoje |
|-------|-----------|-------------------|
| STT (frase curta) | 0,3–1,0 s | Whisper `small` costuma estourar |
| `classifyUserIntent` | 0,05–0,2 s | Já ok (regex/aliases PT-BR) |
| Ação PC | 0,1–0,5 s | Já shipped |
| Chat curto | 0,5–2,0 s | Free→Ollama pode +1–4 s de rede |
| TTS início | 0,2–0,8 s | Off por padrão |

---

## O que o Kobi ensina (sem copiar o produto)

| Kobi (landing) | Elio |
|----------------|------|
| STT / wake word **local**, não Whisper como default | Whisper é primário — principal dor |
| Comandos do dia a dia = **intents**, não LLM | Já é o modelo ADR 0005 — reforçar |
| IA local pequena; nuvem só no pesado | Cascata 0011 inverte prioridade na conversa curta |
| TTS do sistema / voz empacotada | TTS existe; falta default on na sessão de voz |
| Hold-to-talk + cancelar | PTT já existe |

Não copiar: pricing, wake word obrigatória, UI de “entalho”, RPA amplo.

---

## Por que o Whisper está doendo (confirmado nos ADRs)

| Problema | Efeito na demo |
|----------|----------------|
| Primário em todas as plataformas | Todo PTT paga cold start do `whisper-cli` |
| Modelo `small` (~466 MB) | 1º uso baixa modelo; PT-BR ainda mangla |
| Subprocess por fala | Spawn + WAV + `-otxt` a cada turno |
| Web Speech no Electron instável no PC do Douglas | Volta ao Whisper por estabilidade, não por velocidade |
| Sem gate de editar transcript | Erro de STT vai direto ao router e quebra a ação |

**Não fazer agora:** subir para `medium`/`large` “para ficar melhor” — piora latência e download. A demo precisa de **STT leve + intents fortes**.

---

## Plano de melhoria (ordem)

### P0 — Separar latência de chat da cascata de cotas

ADR 0011 continua válido para **cota / tarefa pesada**. Para lane `chat` **curta** (cumprimento, 1 frase), preferir:

1. Ollama já quente **ou** provedor de baixa latência (ex. Groq),  
2. só depois OpenRouter `:free` / BYOK.

Quando o usuário pedir uma IA explícita (“usa o Claude”) ou o intent for pesado (“gera imagem”, “faz um site”), usar a cascata de cotas / Fase E.

**DoD:** “oi, tudo bem?” não depende de round-trip OpenRouter se Ollama estiver up.

### P0 — Tirar Whisper do caminho crítico da demo

Ordem de pragmatismo no Windows:

| Opção | Prós | Contras |
|-------|------|---------|
| Bridge **nativo** Windows Speech (COM), não Web Speech no Chromium | Rápido, grátis, bom PT-BR no SO | Native helper / addon |
| Sherpa-ONNX / Vosk pt-BR embutido | Offline, leve, sem spawn Whisper | Empacotar modelo; calibrar |
| Groq `whisper-large-v3-turbo` no PTT | Muito rápido; tier free | Rede; áudio sai do PC |
| Whisper só como **fallback** | Já no código | Não usar como `auto` na demo |

Atualizar política em `sttPolicy` + ADR 0008 quando uma opção acima passar no checklist §7.

### P1 — Intents blindados + normalização pré-router

- Aliases à prova de STT: chrome / google chrome / edge / spotify / instagram / “abre o…”.  
- Expandir normalização (hoje em `whisperPtBrNormalize`) **antes** de `classifyUserIntent`, também para opens.  
- **Invariante:** “abre o Chrome” **nunca** cai em lane `chat`/LLM. Se cair, o bug é transcript ou classificador — não “IA lenta”.

### P1 — Small talk sem LLM (opcional, alto impacto)

Lane ou pré-filtro para `oi` / `tudo bem` / `bom dia` → resposta curta + TTS, sem modelo. Só escala para LLM se não casar. Imita a “resposta imediata” do Kobi sem GPU.

### P2 — Fase A1 / A2 (TTS)

Ligar fala na sessão de voz + confirmação falada pré-ação. Já no [`roadmap.md`](./roadmap.md); não compete com multi-IA.

---

## Roteamento para IA conectada

Sim: depois do texto, classificar e escalar. O classificador é barato; o trabalho pesado que demora.

| Sinal | Rota |
|-------|------|
| abre / toca / timer / volume / desliga… | `pc_action` local |
| oi / bom dia / tudo bem | chat curto local ou template |
| gera imagem / faz um site / código longo | IA conectada |
| “usa o Claude / o GPT” | forçar provedor |
| confiança baixa no intent | pedir de novo **ou** escalar chat |

---

## Checklist de dogfooding (pass/fail)

| # | Teste | Passa se |
|---|-------|----------|
| 1 | PTT: “abre o Google Chrome” | Chrome abre em ≤2 s após soltar o mic |
| 2 | PTT: “oi, tudo bem?” | TTS começa em ≤3 s |
| 3 | PTT: “toca [música] no Spotify” | Intent Spotify, sem ir ao chat LLM |
| 4 | Sem rede + “abre o Chrome” | Ação local ainda funciona |
| 5 | “gera uma imagem de um gato” | Roteia cloud; geração pode demorar |

Não abrir PRs de Fase E enquanto **1** e **2** estiverem vermelhos.

---

## Relação com docs existentes

| Doc | Papel |
|-----|--------|
| Este | *Como melhorar latência agora* (engenharia + ordem) |
| `produto.md` | Norte (o quê / para quem) |
| `roadmap.md` | Quando (Fase A primeiro) |
| ADRs | Decisões já tomadas; este guia pode **motivar** revisão de 0008/0011 |

---

## Próximo PR sugerido

1. Política STT da demo sem Whisper-first (ou Whisper só fallback) + telemetria leve de latência PTT→ação.  
2. Rota de chat curto por latência (Ollama/Groq antes de free na conversa curta).  
3. Só então A1/A2 TTS se ainda não estiverem verdes.
