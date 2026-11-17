# Elio — melhoria de latência de voz (pós-Kobi)

**Status:** guia de engenharia (não ADR)  
**Atualizado:** 2026-11-17 (America/Sao_Paulo) — + acerto STT, Web Speech no Electron, Cursor ≠ SDK  
**Âncora:** [`produto.md`](./produto.md) · [`roadmap.md`](./roadmap.md) · ADR 0002 · 0005 · 0008 · 0011  
**Referência externa:** [Kobi](https://hiagorzandonadi.github.io/kobi/) (produto comercial “companheiro no entalho”)  
**Público deste doc:** handoff para implementação no Elio (dogfooding Douglas)

Objetivo: fechar o loop que importa no dogfooding — **“oi, tudo bem?”** e **“abre o Google Chrome”** em **~1–3 s**, com transcript **fiel o bastante** para o intent — sem Whisper como caminho crítico. Geração de imagem/site na nuvem **pode demorar**; isso está fora do problema.

Em conflito com Fase E (multi-IA) ou conectores: **Fase A / este guia vencem** até a checklist §7 estar verde.

---

## Veredito

Dá para ficar rápido **e** entender melhor o que foi falado. O Elio **já tem** o roteador de intents ([ADR 0005](./ADRs/0005-desktop-opens-intent-router.md)). O que está matando a sensação de companheiro é:

1. **Whisper-first** ([ADR 0008](./ADRs/0008-windows-speech-primary-stt.md) revisado + [ADR 0002](./ADRs/0002-whisper-subprocess.md)): cold start, spawn por fala, `small` **lento e errado** em PT-BR coloquial.
2. **Cascata de chat** ([ADR 0011](./ADRs/0011-ai-cascade-byok.md)): BYOK → free → Ollama prioriza **cota**, não **latência** — “oi, tudo bem?” pode ir à nuvem à toa.
3. **TTS off por padrão** (Fase A1 no roadmap): mesmo com STT bom, a demo “não fala”.

**Direção de STT para o próximo implementador:** não extrair voz do Cursor; conectar STT de nuvem equivalente (Groq / xAI) no PTT, Whisper só fallback. Detalhe na § “Cursor e STT” e no P0 abaixo.

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
| Acerto ruim em fala natural | Pedido certo vira transcript errado → intent/ação errados |

Dois sintomas, mesma causa de produto: **Whisper local `small` não serve como ouvido principal** (atrasa **e** deturpa). “Falar mais devagar” não é a solução.

**Não fazer agora:** subir para `medium`/`large` “para ficar melhor” — piora latência e download. A demo precisa de **STT bom o bastante + intents fortes**.

---

## Web Speech no Electron — não repetir o ciclo

Histórico (ADR 0008 + dogfooding): o microfone do Windows funcionava (Gravador de Voz OK), mas o caminho **Web Speech (`webkitSpeechRecognition`) no renderer do Electron** ficava em “Não ouvi nada”. Várias rodadas de “arrumar o mic” no mesmo stack **não fecharam**.

| Caminho | O que é de verdade |
|---------|-------------------|
| Apps nativos / Gravador | Speech Runtime / áudio do SO |
| Elio “Windows Speech” atual | API do Chromium no Electron — permissão, device exclusivo, `getUserMedia` + Speech brigando pelo mic |

**Decisão de handoff:** não abrir mais PRs cujo único plano seja “mais um patch no Web Speech do renderer”. Se um dia voltar Speech do Windows, tem que ser **helper nativo (COM) fora do Chromium**, não Web Speech de novo.

---

## Cursor e STT — o que *não* fazer e o que fazer

O ditado / voz do **Cursor** parece bom. Isso **não** se extrai:

- Não existe SDK/`@cursor/speech` para embutir no Electron do Elio.
- Ditado e voice chat são **recursos do produto Cursor** (conta logada), não biblioteca redistribuível.
- Proibido como direção: copiar binário do Cursor, hook na UI, scrapear o IDE.

O que o Cursor usa por baixo é, na prática, **STT de nuvem de boa qualidade**. No Elio replica-se a **mesma classe de serviço** com chave própria (BYOK), no main — padrão já usado com OpenRouter:

| Provedor (exemplos) | Papel no Elio |
|---------------------|---------------|
| **Groq** `whisper-large-v3-turbo` | PTT rápido; tier free generoso; destravar demo |
| **xAI STT** (`api.x.ai/v1/stt`, ex. `grok-voice-transcribe-*`) | Mesma família documentada no ecossistema Grok/voz |
| Whisper local | **Só fallback** offline / falha de rede |
| Web Speech no Electron | **Fora** do caminho crítico |

Fluxo alvo: PTT → gravar áudio (já existe para Whisper) → `POST` STT no **main** (chave só no cofre/`safeStorage`, nunca no renderer) → texto → normalizar → `classifyUserIntent` → ação / chat / cloud.

---

## Plano de melhoria (ordem)

### P0 — STT de nuvem no PTT (direção preferida para o próximo PR)

**Escolha default sugerida para destravar dogfooding:** Groq (ou xAI) como `ELIO_STT_PROVIDER` no PTT; Whisper só se rede/chave falhar.

| Item | Detalhe |
|------|---------|
| Entrada | WAV/WebM que o PTT já captura |
| Saída | transcript PT-BR → pipeline atual |
| Segredo | chave no main / Integrações (mesmo espírito do OpenRouter) |
| Política | atualizar `sttPolicy` + ADR 0008 |
| Offline | opens/`pc_action` ainda devem funcionar se o transcript vier de fallback Whisper; sem rede e sem Whisper quente → erro falado honesto |

**DoD:** checklist §7 itens 1–2 verdes com fala natural (não só ditado lento).

Alternativas (depois ou em paralelo, se BYOK de STT for indesejável):

| Opção | Quando faz sentido |
|-------|--------------------|
| Sherpa-ONNX / Vosk pt-BR | Quer 100% offline sem Whisper |
| Bridge COM Windows Speech | Investimento maior; só se valer o nativo de verdade |
| Whisper `auto` | **Não** — só fallback |

### P0 — Separar latência de chat da cascata de cotas

ADR 0011 continua válido para **cota / tarefa pesada**. Para lane `chat` **curta** (cumprimento, 1 frase), preferir:

1. Ollama já quente **ou** provedor de baixa latência (ex. Groq),  
2. só depois OpenRouter `:free` / BYOK.

Quando o usuário pedir uma IA explícita (“usa o Claude”) ou o intent for pesado (“gera imagem”, “faz um site”), usar a cascata de cotas / Fase E.

**DoD:** “oi, tudo bem?” não depende de round-trip OpenRouter se Ollama estiver up.

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
| 1 | PTT: “abre o Google Chrome” (fala natural) | Transcript certo o bastante + Chrome em ≤2 s |
| 2 | PTT: “oi, tudo bem?” | TTS começa em ≤3 s |
| 3 | PTT: “toca [música] no Spotify” | Intent Spotify, sem ir ao chat LLM |
| 4 | Sem rede + fallback | Com Whisper em disco: ainda abre app; sem STT: erro falado, sem mentir |
| 5 | “gera uma imagem de um gato” | Roteia cloud; geração pode demorar |
| 6 | Regressão | Sem chave STT no renderer/logs; Web Speech não volta como `auto` |

Não abrir PRs de Fase E enquanto **1** e **2** estiverem vermelhos.

---

## Relação com docs existentes

| Doc | Papel |
|-----|--------|
| Este | *Como melhorar latência + acerto de STT agora* (engenharia + ordem de handoff) |
| `produto.md` | Norte (o quê / para quem) |
| `roadmap.md` | Quando (Fase A primeiro) |
| ADRs | Decisões já tomadas; este guia **motiva** revisão de 0008 (e nuance de 0011 para chat curto) |

---

## Brief de handoff (passar para quem for implementar no Elio)

Copiar/colar como prompt de PR:

1. **Não** extrair reconhecimento de voz do Cursor; **não** insistir em Web Speech no Electron.  
2. Implementar **STT de nuvem no PTT** (preferência: Groq `whisper-large-v3-turbo` ou xAI `/v1/stt`) com chave no main/`safeStorage`; Whisper = fallback.  
3. Atualizar `sttPolicy` + ADR 0008; telemetria leve PTT→transcript→ação (latência, sem texto de fala nos logs).  
4. Rota de **chat curto por latência** (Ollama/rápido antes de OpenRouter free).  
5. P1: normalização + aliases de opens; small talk sem LLM se couber no mesmo PR sem estourar escopo.  
6. Critério de pronto = checklist §7 itens **1, 2 e 6** verdes.  
7. Só depois: Fase A1/A2 TTS se ainda faltarem; Fase E continua estacionada.
