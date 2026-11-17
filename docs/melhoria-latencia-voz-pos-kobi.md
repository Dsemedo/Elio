# Elio — guia de voz, latência e cascata (SKU vitalício)

**Status:** guia de engenharia / handoff (não ADR)  
**Atualizado:** 2026-11-17 (America/Sao_Paulo)  
**Repo:** [Dsemedo/Elio](https://github.com/Dsemedo/Elio)  
**Âncora:** [`produto.md`](./produto.md) · [`roadmap.md`](./roadmap.md) · ADR 0002 · 0005 · 0008 · 0011  
**Referência:** [Kobi](https://hiagorzandonadi.github.io/kobi/) (só inspiração de modelo: local no dia a dia, nuvem opcional)

**Para quem:** colar este doc (ou o brief do final) nos chats do Elio quando for implementar.

---

## 1. Norte em uma frase

> O Elio **sempre** ouve e decide **no PC**. A nuvem só entra quando a IA local identifica um pedido que ela **não consegue** atender — e só com **chave do usuário**.

Dogfood = o que será vendido (pagamento único / uso contínuo **sem** o vendedor pagar STT nem LLM por cliente).

---

## 2. Arquitetura-alvo (o que construir)

```text
  microfone
      │
      ▼
 ┌─────────────┐
 │ STT LOCAL   │  voz → texto (sempre no PC)
 └──────┬──────┘
        ▼
 ┌─────────────┐
 │ CÉREBRO     │  IA / roteador LOCAL (sempre recebe o turno)
 │ LOCAL       │
 └──────┬──────┘
        │
        ├─ sei fazer sozinho ──► ação no PC / resposta curta + TTS
        │                        (abre Chrome, oi, timer, Spotify…)
        │
        └─ não sei fazer ──────► CASCATA (IAs conectadas pelo usuário)
                                 (gera imagem, site grande, código pesado…)
                                      │
                                      ├─ tem chave? ──► chama essa IA
                                      └─ não tem?  ──► fala: “conecte uma IA para isso”
```

### Papéis (não misturar)

| Camada | O que é | Default do SKU vitalício |
|--------|---------|---------------------------|
| **STT** | Voz → texto | **Só local** (nunca chave do vendedor; nunca “Groq do Douglas”) |
| **Cérebro de porta** | Entende o pedido e escolhe o caminho | **Sempre local** (regras +/ou modelo pequeno / Ollama) |
| **Ações no PC** | Opens, Spotify, etc. | Local + allowlist (já ADR 0005) |
| **Cascata** | Trabalho pesado | Só se o usuário **conectou** Claude / ChatGPT / Gemini / etc. |
| **TTS** | Resposta falada | Local / sistema (Fase A1) |

**Nota:** Groq (API) ≠ Grok/xAI. Nenhum dos dois é o ouvido padrão do produto. Se um dia existirem no Elio, entram como **provedor opcional na cascata (BYOK)**, não como STT obrigatório.

---

## 3. O que “rápido” significa

Do **fim da fala** (soltar o PTT) até a ação começar ou o TTS falar:

| Pedido | Caminho | Meta |
|--------|---------|------|
| “abre o Google Chrome” | STT local → intent → open | **≤ 2 s** |
| “oi, tudo bem?” | STT local → resposta curta local + TTS | **≤ 3 s** |
| “gera uma imagem de um gato” | STT local → local decide CLOUD → BYOK | Decisão **&lt; 0,2 s**; gerar pode demorar |
| Mesmo pedido **sem** IA conectada | Local responde falando | “Conecte uma IA em Integrações” — **não** usa key do vendedor |

Geração lenta na nuvem **não** é bug de produto. Ouvido lento / transcript errado **é**.

---

## 4. Como a IA local sabe que precisa da cascata

A local **sempre** atende o turno: executa, encaminha ou pede conexão. Três mecanismos (combinar):

### A) Regras / intents (primeiro, barato)

Exemplos de sinais → rota:

| Texto (PT-BR) | Rota |
|---------------|------|
| abre / toca / timer / volume / desliga… | `LOCAL` + `pc_action` |
| oi / bom dia / tudo bem | `LOCAL` + small talk |
| gera imagem / desenha / ilustra | `CLOUD:image` |
| faz um site / landing / app completo | `CLOUD:codegen` |
| “usa o Claude / o GPT” | forçar provedor (se conectado) |

Isso é extensão natural de `classifyUserIntent` ([ADR 0005](./ADRs/0005-desktop-opens-intent-router.md)): além de `pc_action` / `chat`, existe lane **`escalate`** (ou equivalente) com `kind`.

### B) Manifesto de capacidades

Lista fixa no app, versionada:

- **Local sabe:** opens allowlist, Spotify, clima/hora, small talk, (Ollama chat curto).  
- **Local não sabe:** image gen, repo grande, site completo, etc.  
- **Cloud sabe se** o usuário conectou o provedor certo.

Antes de chamar nuvem: `if !hasCapability(kind) && !userHasProvider(kind) → speakNeedConnection(kind)`.

### C) LLM local só como desempate (opcional)

Prompt mínimo, resposta estruturada, ex.: `LOCAL` | `CLOUD:image` | `CLOUD:codegen` | `CLOUD:chat`.  
Não usar LLM de hub no default do SKU para classificar “oi” / “abre o Chrome”.

**Ordem sugerida:** regras → manifesto → (opcional) LLM local → executar ou escalar.

---

## 5. Modelo econômico (por que não STT/LLM na conta do vendedor)

| Situação | Quem paga |
|----------|-----------|
| Ouvir + decidir + abrir Chrome + “oi” | **Ninguém além do PC do cliente** |
| Gerar imagem / site com Claude/GPT | **Cliente** (chave / cota dele) |
| 10 mil vitalícios no default | Custo de API do vendedor ≈ **R$ 0** |
| Key do Douglas no instalador | **Proibido** — escala e segurança |

Vitalício ilimitado + nuvem na conta do vendedor **não fecha**. Por isso o dogfood já é 100% nesse formato.

---

## 6. Problemas de hoje no Elio (contexto)

| Dor | Leitura |
|-----|---------|
| Whisper `small` lento | Estoura meta de 1–3 s |
| Whisper interpreta errado | Intent/ação errados em fala natural |
| Web Speech no Electron | “Não ouvi nada” com mic do SO OK — **não repetir** patches nesse stack ([ADR 0008](./ADRs/0008-windows-speech-primary-stt.md)) |
| Cascata ADR 0011 (BYOK → free → Ollama) | Boa para quem **já conectou** hub; **não** deve ser o ouvido nem o default de “oi” no SKU vitalício |
| TTS off por padrão | Demo “não fala” (Fase A1) |

**Não fazer:** Whisper `medium`/`large` como solução.  
**Não fazer:** “começar no Groq free do vendedor e trocar depois”.  
**Não fazer:** extrair ditado do Cursor (não existe SDK; é recurso do produto Cursor).

---

## 7. STT local — direção técnica

Substituir Whisper-first por um ouvido **local** bom o bastante para PT-BR + intents:

| Opção | Nota |
|-------|------|
| **Sherpa-ONNX** ou **Vosk** pt-BR | Preferível para Electron multiplataforma / controle de custo |
| **Helper COM** Windows Speech (fora do Chromium) | Válido se a aposta for Windows-first nativo de verdade |
| Whisper.cpp | Só **fallback** degradado, se ainda fizer sentido |
| Web Speech no renderer | **Fora** do `auto` |

Fluxo: PTT → áudio → STT local → normalizar PT-BR → `classifyUserIntent` / cérebro local → ação, small talk ou `escalate`.

---

## 8. Plano de PRs (ordem)

### P0 — Ouvido + cérebro local (SKU)

1. STT local novo como `auto`; atualizar `sttPolicy` + ADR 0008.  
2. Lane de small talk / resposta curta **sem** hub.  
3. Telemetria de latência PTT→ação (sem logar texto de fala).  
4. Testes **com rede desligada** (checklist abaixo).

### P0 — Escalação explícita

1. Estender o router: `LOCAL` vs `CLOUD:kind`.  
2. Manifesto de capacidades + mensagem falada se faltar conexão.  
3. Ainda **sem** implementar todos os provedores — o contrato da cascata já existe.

### P1 — Cascata BYOK (IAs pesadas)

1. Usuário conecta chaves (Claude / OpenAI / Gemini / hub) no cofre (`safeStorage`), como espírito do [ADR 0011](./ADRs/0011-ai-cascade-byok.md) / Fase E.  
2. Local escolhe o provedor pelo `kind` + preferência do usuário.  
3. Label “quem atendeu” na UI/TTS.  
4. Sem key do vendedor em lugar nenhum.

### P1 — Intents blindados

Aliases chrome/spotify; normalização pré-router; “abre o Chrome” **nunca** cai em LLM de hub.

### P2 — TTS A1/A2

Fala na sessão de voz + confirmação falada pré-ação.

---

## 9. Checklist de aceite (dogfood = SKU)

| # | Teste | Passa se |
|---|-------|----------|
| 1 | “abre o Google Chrome” **sem rede** | ≤ 2 s, app abre |
| 2 | “oi, tudo bem?” **sem rede** | TTS ≤ 3 s |
| 3 | Fala natural (não ditado lento) | Transcript serve para o intent |
| 4 | Install limpa, **sem** colar key | Default local funciona |
| 5 | “gera uma imagem…” **sem** IA conectada | Pede para conectar; **não** chama API do vendedor |
| 6 | Mesmo pedido **com** BYOK | Encaminha; geração pode demorar; mostra quem atendeu |
| 7 | Segredos | Sem key no renderer/instalador/logs; Web Speech ≠ `auto` |

Pronto para seguir TTS / Fase E só com **1, 2, 4, 5, 7** verdes.

---

## 10. Brief para colar no chat do Elio

```text
Implementar no Elio conforme docs/melhoria-latencia-voz-pos-kobi.md:

1) SKU vitalício = dogfood. STT sempre LOCAL. Cérebro/roteador LOCAL sempre recebe o turno.
2) Nuvem só na CASCATA: quando o local classificar pedido pesado (imagem, site, etc.) E o usuário tiver conectado a IA. Senão, resposta falada pedindo conexão. Zero key do vendedor.
3) Não usar Groq/xAI como ouvido padrão. Não extrair voz do Cursor. Não patchar Web Speech no Electron de novo.
4) Trocar Whisper-first por Sherpa/Vosk (ou COM nativo). Whisper só fallback degradado se fizer sentido.
5) Extender classifyUserIntent: LOCAL vs CLOUD:kind + manifesto de capacidades.
6) Chat curto / “oi” sem hub. Opens continuam allowlist.
7) Critério de pronto: checklist do doc itens 1,2,4,5,7 (incluindo testes sem rede).
8) Não abrir Fase E completa antes do ouvido+roteador local verdes. TTS A1/A2 depois.
```

---

## 11. Relação com docs existentes

| Doc | Papel |
|-----|--------|
| **Este** | Como ouvir, decidir, escalar e vender vitalício |
| `produto.md` | O quê / para quem |
| `roadmap.md` | Quando (Fase A primeiro) |
| ADR 0005 | Intent router base |
| ADR 0008 / 0002 | STT — este guia **pede revisão** do default Whisper |
| ADR 0011 | Cascata de LLM **para quem conectou** chave — não é STT |
