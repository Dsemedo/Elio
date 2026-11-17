# Elio — melhoria de latência de voz (pós-Kobi)

**Status:** guia de engenharia (não ADR)  
**Atualizado:** 2026-11-17 (America/Sao_Paulo) — dogfood = produto vitalício (STT local default)  
**Âncora:** [`produto.md`](./produto.md) · [`roadmap.md`](./roadmap.md) · ADR 0002 · 0005 · 0008 · 0011  
**Referência externa:** [Kobi](https://hiagorzandonadi.github.io/kobi/) (produto comercial “companheiro no entalho”)  
**Público deste doc:** handoff para implementação no Elio (dogfooding = o que será vendido)

Objetivo: fechar o loop — **“oi, tudo bem?”** e **“abre o Google Chrome”** em **~1–3 s**, com transcript **fiel o bastante** para o intent — no **mesmo formato do produto à venda** (pagamento único / acesso contínuo **sem** o Douglas pagar STT/LLM de nuvem por usuário). Geração de imagem/site na nuvem **pode demorar** e só com **chave do comprador**.

Em conflito com Fase E (multi-IA) ou conectores: **Fase A / este guia vencem** até a checklist §7 estar verde.

---

## Princípio de produto (obriga a engenharia)

> **Dogfood = SKU.** O caminho que Douglas usa no dia a dia tem que ser o caminho do cliente que pagou vitalício.

| Modelo | Pode? | Por quê |
|--------|-------|---------|
| STT / chat **local** no default (custo marginal ≈ R$ 0 por usuário) | **Sim — default** | Escala para 10k vitalícios |
| Nuvem (Groq, xAI/Grok STT, OpenRouter…) com **chave do usuário** (BYOK) | Sim — **opcional** | Cliente paga a própria cota |
| Chave do vendedor embutida no instalador / “Groq free do Douglas” para todo mundo | **Não** | 10k usuários estouram a conta; vazamento de key; vitalício ilimitado não fecha |
| Começar a demo em nuvem free “e trocar depois” | **Não** (decisão Douglas) | Otimiza o caminho errado; a troca nunca é “só config” |

**Nota de nomes:** **Groq** (API rápida de inferência/STT) ≠ **Grok/xAI** (outro provedor). Os dois, se existirem no Elio, são **BYOK opcional** — nunca default do SKU vitalício.

---

## Veredito

Dá para ficar rápido **e** entender melhor o que foi falado **sem** depender de STT pago pelo vendedor. O Elio **já tem** o roteador de intents ([ADR 0005](./ADRs/0005-desktop-opens-intent-router.md)). O que está matando a sensação de companheiro é:

1. **Whisper-first** ([ADR 0008](./ADRs/0008-windows-speech-primary-stt.md) revisado + [ADR 0002](./ADRs/0002-whisper-subprocess.md)): cold start, spawn por fala, `small` **lento e errado** em PT-BR coloquial.
2. **Cascata de chat** ([ADR 0011](./ADRs/0011-ai-cascade-byok.md)): BYOK → free → Ollama prioriza **cota**, não **latência** — e o “free” de hub não é o default do SKU vitalício.
3. **TTS off por padrão** (Fase A1): mesmo com STT bom, a demo “não fala”.

**Direção para o próximo implementador:** STT **local** (não Whisper-first, não Web Speech no Electron) como `auto` do produto; nuvem só se o usuário colar a chave dele; chat curto local/template; nunca chave do vendedor no binário.

---

## O que é “rápido” neste documento

Do **fim da fala** (soltar o PTT) até a ação começar ou o TTS emitir o primeiro som.

**Meta: ~1–3 segundos** no caminho **local** (o que o cliente vitalício recebe sem configurar nada).

| Pedido | Lane | O que deve rodar (SKU) | Meta |
|--------|------|------------------------|------|
| abre o Google Chrome | `pc_action` | STT local → intent → open | ≤2 s |
| oi, tudo bem? | chat curto / template | STT local → resposta curta + TTS (sem nuvem) | ≤3 s |
| gera uma imagem / um site | cloud | só se houver **BYOK**; senão erro falado honesto | classificar &lt;0,2 s |

---

## Orçamento de latência (caminho feliz = local)

| Etapa | Orçamento | Nota |
|-------|-----------|------|
| STT local (frase curta) | 0,3–1,0 s | Alvo do novo backend; Whisper `small` estoura |
| `classifyUserIntent` | 0,05–0,2 s | Já ok |
| Ação PC | 0,1–0,5 s | Já shipped |
| Chat curto local | 0,5–2,0 s | Template ou Ollama; sem OpenRouter no default do SKU |
| TTS início | 0,2–0,8 s | Fase A1 — default on na sessão de voz |

---

## Modelo econômico (vitalício)

Espelho do que o Kobi comunica (sem copiar o produto): **paga o app uma vez**; voz/IA do dia a dia **no PC**; cloud **opcional com chave do cliente**.

```text
[Cliente vitalício]
  STT local  ──► intents / opens / small talk / Ollama
       │
       └── (opcional) BYOK Groq | xAI | OpenRouter | …
              └── só o que o cliente conectou; custo dele
```

Com **10 mil** vitalícios: custo de STT/LLM do vendedor no default ≈ **R$ 0**.  
Se o default fosse a chave Groq/xAI do Douglas: cada PTT de cada cliente sairia da conta dele — inviável.

---

## O que o Kobi ensina (sem copiar)

| Kobi | Elio (SKU) |
|------|------------|
| STT local no default | **Obrigatório** no dogfood |
| Comandos = intents | Já ADR 0005 |
| Nuvem com chave do usuário | BYOK (OpenRouter hoje; STT cloud opcional depois) |
| Whisper como ouvido principal | **Não** |
| Web Speech no Electron | **Não** |

---

## Por que o Whisper atual não é o STT do SKU

| Problema | Efeito |
|----------|--------|
| Primário + subprocess | Lento |
| `small` PT-BR | Interpreta errado em fala natural |
| Download ~466 MB | Fricção de 1º uso |
| Não é o “ouvido” que o produto quer vender | Dogfood no caminho errado |

**Não fazer:** `medium`/`large` como “solução”.  
**Não fazer:** trocar Whisper por Groq free do vendedor “só para desenvolver”.

---

## Web Speech no Electron — não repetir

Mic do SO OK + “Não ouvi nada” no Electron = stack Web Speech, não “mic quebrado”.  
**Handoff:** zero PRs de “mais um patch no Web Speech”. Speech do Windows só via **helper COM nativo**, se um dia for a aposta.

---

## Cursor e STT de nuvem

Cursor ditado **não** se extrai (sem SDK). Qualidade boa ≈ STT de nuvem.

No Elio vitalício isso vira **Integração opcional (BYOK)**, não default:

| Peça | Papel no SKU |
|------|----------------|
| Sherpa-ONNX / Vosk pt-BR (ou COM Speech) | **Default** — incluído no que foi vendido |
| Groq / xAI STT | Opcional; chave do **cliente** no `safeStorage` |
| Whisper.cpp | Fallback local degradado, se ainda valer a pena |
| Chave do Douglas no instalador | **Proibido** |

---

## Plano de melhoria (ordem)

### P0 — STT local de produto (direção do próximo PR)

Implementar o ouvido que o cliente vitalício recebe **sem cadastrar cartão nem colar key**.

| Opção (escolher uma e ADR) | Prós | Contras |
|----------------------------|------|---------|
| **Sherpa-ONNX ou Vosk pt-BR** embutido/baixado no 1º uso | Offline, custo R$ 0/usuário, controlável no Electron | Empacotar modelo; calibrar PT-BR |
| **Helper COM** Windows Speech (fora do Chromium) | Bom PT-BR do SO, grátis | Só Windows; trabalho nativo |
| Whisper `auto` | — | **Rejeitado** como default |
| Groq/xAI free do vendedor | — | **Rejeitado** como default / dogfood principal |

**DoD:** checklist §7 com **rede desligada** (itens 1–2 e 4) — é o teste do SKU vitalício.

### P0 — Chat curto local (não cascata de cota)

No SKU: small talk / cumprimento → template ou Ollama local.  
OpenRouter / Groq LLM só com BYOK ou pedido explícito.  
ADR 0011 permanece para quem **conectou** chave; não manda o default vitalício para free de hub.

### P1 — BYOK de STT/LLM (opcional)

UI Integrações: “Conectar Groq / xAI / OpenRouter”.  
Melhora acerto/latência **para quem quer**; zero custo para quem não conecta.  
Nunca embutir key de produção do vendedor.

### P1 — Intents + normalização + small talk

Aliases chrome/spotify; normalizar pré-router; `oi`/`bom dia` sem LLM.

### P2 — Fase A1 / A2 (TTS)

Fala na sessão de voz + confirmação falada.

---

## Roteamento para IA conectada

| Sinal | Rota no SKU |
|-------|-------------|
| abre / toca / … | `pc_action` local |
| oi / bom dia | local / template |
| gera imagem / site / código longo | BYOK cloud; senão “conecte uma IA” falado |
| “usa o Claude” | só se conectado |

---

## Checklist de dogfooding (= aceite do SKU)

| # | Teste | Passa se |
|---|-------|----------|
| 1 | “abre o Google Chrome” **sem rede** | Transcript ok + ≤2 s |
| 2 | “oi, tudo bem?” **sem rede** | TTS ≤3 s (template/Ollama) |
| 3 | Spotify por nome | Intent, sem LLM de hub |
| 4 | Instalação limpa, **sem** colar key de STT | Default local funciona |
| 5 | Sem BYOK + “gera uma imagem” | Erro falado honesto (não usa key do vendedor) |
| 6 | Com BYOK STT (opcional) | Usa a chave do usuário; nunca loga a key |
| 7 | Regressão | Web Speech ≠ `auto`; sem secret no renderer/instalador |

Não abrir Fase E enquanto **1, 2, 4 e 7** estiverem vermelhos.

---

## Relação com docs existentes

| Doc | Papel |
|-----|--------|
| Este | Latência + acerto + **formato do SKU vitalício** |
| `produto.md` | Norte |
| `roadmap.md` | Fase A primeiro |
| ADRs | Revisar 0008 (default STT); nuance 0011 (chat curto local no SKU) |

---

## Brief de handoff (colar no PR)

1. Dogfood = produto vitalício: **STT local default**, custo R$ 0/usuário no caminho feliz.  
2. **Não** começar com Groq/xAI free do vendedor; **não** extrair Cursor; **não** Web Speech no Electron.  
3. Implementar Sherpa/Vosk **ou** helper COM; Whisper só fallback degradado se fizer sentido.  
4. Chat curto local/template; nuvem só BYOK.  
5. Proibido: API key do vendedor no instalador, env de produção commitado, key no renderer.  
6. Pronto = checklist **1, 2, 4, 7**.  
7. BYOK Groq/xAI = P1 opcional depois do local verde. TTS A1/A2 em seguida. Fase E estacionada.
