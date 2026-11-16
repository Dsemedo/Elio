# Elio — ações no PC e conectores

**Status:** vigente (arquitetura de produto)  
**Atualizado:** 2026-11-16  
**Âncora:** [`produto.md`](./produto.md) · ordem: [`roadmap.md`](./roadmap.md) (Fase F)

Este doc responde **como** o Elio age no computador e em apps conectados (Outlook, Teams, etc.) sem virar RPA cego nem scrapear UI.

---

## Ideia em uma frase

> Pedido em voz/texto → **intent allowlisted** → **conector oficial** (ou open local) → confirmação falada → dados → (opcional) **resumo via LLM** → Elio fala / mostra o resultado.

O LLM **não** “tem acesso livre” ao PC ou ao e-mail. Ele só resume o que um conector **já buscou** com permissão explícita.

---

## Três tipos de capacidade

| Tipo | Exemplos | Como fazemos |
|------|----------|--------------|
| **A — Desktop local** | “Abre o Instagram”, “Abre o Edge”, pasta, digitar no foco | Já existe em parte: allowlist `shell.openExternal` / `openPath` / input ([ADR 0005](./ADRs/0005-desktop-opens-intent-router.md), 0015) |
| **A2 — Energia do PC** | “Desliga o PC”, “desliga em 10 minutos”, “cancela o desligamento” | **Possível no Windows** — ver secção abaixo (ainda não shipped) |
| **B — Conector de app** | Outlook, Teams, Spotify, calendário | OAuth/API **oficial** + operações na allowlist do conector |
| **C — LLM / multi-IA** | Explicar, resumir, “faz um site” | Cascata de IAs ([produto horizonte](./produto.md), Fase E) — **depois** dos dados do conector |

“Como estão meus e-mails?” é **B + C**: Graph busca → LLM resume → TTS fala.  
“Desliga em dez minutos” é **A2**: intent tipado → binário fixo do Windows → confirmação → agendar / abortar.

---

## A2 — Desligar / reiniciar / cancelar (Windows)

**Sim, é possível.** O Windows já expõe isso de forma oficial (`shutdown.exe`). O Elio não precisa de RPA nem de “clicar no menu Iniciar”.

### Pedidos que queremos aceitar

| Frase do usuário | Operação allowlisted | Comando efetivo (conceito) |
|------------------|----------------------|----------------------------|
| “Desliga o computador” | `power.shutdown` agora | `shutdown /s /t 0` (após confirmação) |
| “Desliga em dez minutos” | `power.shutdown` com delay | `shutdown /s /t 600` |
| “Reinicia em 5 minutos” | `power.restart` + delay | `shutdown /r /t 300` |
| “Cancela o desligamento” | `power.abort` | `shutdown /a` |

Delay: parsear pt-BR (“dez minutos”, “em 1 hora”) → segundos com **teto** (ex.: máx. 24 h) via Zod. Sem string livre no shell.

### Como implementar com segurança (quando for a hora)

```text
1. Router → intent tipado { kind: "power.shutdown", delaySec: 600 }
2. Confirmação falada obrigatória:
   - imediato: “Vou desligar o PC agora. Confirma?”
   - agendado: “Vou desligar em 10 minutos. Confirma?”
3. Só depois: spawn de argv fixo
   - arquivo: %SystemRoot%\System32\shutdown.exe
   - args: ["/s", "/t", "600"]  // números já validados; shell: false
4. Elio fala: “Combinado — desligo em 10 minutos. Diga ‘cancela o desligamento’ se mudar de ideia.”
5. “Cancela…” → shutdown /a + TTS
```

**Não** usar `exec("shutdown " + textoDoUsuario)`, PowerShell interpolado, nem deixar o LLM escolher o comando.

### Regras de produto

1. **Confirmação** sempre (ação destrutiva) — voz e/ou botão na barra.  
2. **Abort** sempre disponível enquanto o timer estiver ativo.  
3. **Allowlist fechada:** só desligar / reiniciar / abortar (hibernar/sleep = fatia depois, se quiser).  
4. **Sem elevação mágica:** desligar a sessão do usuário costuma bastar; se o SO negar, falar o erro — não pedimos UAC escondido.  
5. **Fora da Fase A:** útil no dia a dia, mas **não** bloqueia a demo canônica (Spotify / Edge / Instagram). Encaixa em **Fase D** (endurecer desktop) quando A estiver verde.

### Estado hoje

Ainda **não** existe no código. O ADR 0005 proíbe `exec` arbitrário para opens; energia exigiria um módulo novo `tools/desktop/power.ts` com argv fixo — exceção **estreita** e testada, no mesmo espírito do input allowlisted (ADR 0015).

---

## Pipeline (igual para Outlook, Teams, …)

```text
1. Usuário: “Quais foram os últimos e-mails?” / “Resume a caixa de entrada”
2. Router PT-BR → intent `outlook.list_recent` (não cai no chat genérico)
3. Gate: conector conectado? senão → “Conecta o Outlook em Integrações”
4. Confirmação falada (dado sensível): “Vou ler seus 5 e-mails mais recentes”
5. Conector executa operação allowlisted (ex.: Graph GET /me/messages?$top=5)
6. UI: lista curta (de, assunto, hora) no Command Center / barra
7. Se pediu resumo: envia ao LLM só subject + bodyPreview (ou trecho limitado)
8. Elio fala: “O primeiro é da Ana: ela pediu o relatório até sexta…”
9. Nada de corpo completo em log; tokens OAuth só no cofre
```

### Exemplo Outlook — o que a API devolve vs o que o LLM vê

| Etapa | Conteúdo |
|-------|----------|
| Graph (allowlist) | `from`, `subject`, `receivedDateTime`, `bodyPreview` (curto) |
| UI | Lista clicável dos 5 últimos |
| Prompt de resumo | Só esses campos + instrução “3 frases em pt-BR, sem inventar” |
| TTS | Resumo falado, um a um ou consolidado (“Você tem 5 novos…”) |

**Não** mandamos a caixa inteira, anexos binários, nem `Mail.ReadWrite` no MVP do conector.

---

## Anatomia de um conector

Cada integração (Outlook, Teams, Spotify…) segue o mesmo contrato:

```text
Connector {
  id: "outlook"
  auth: OAuth PKCE (Microsoft) → tokens no safeStorage
  scopes: mínimos (ex.: Mail.Read, User.Read) — nunca "tudo"
  operations: allowlist tipada
    - list_recent_mail { top: 1..10 }
    - summarize_recent_mail { top: 1..5 }  // list + LLM
    - (depois) get_mail { id }             // com confirmação
  speak: frases de confirmação / resultado / erro
  ui: card em Integrações + resultado no chat
}
```

O router só dispara `operations` que existem. O LLM **não** inventa chamadas Graph.

### Microsoft Graph (Outlook + Teams)

| Pedido do usuário | Operação | Scope típico (mínimo) |
|-------------------|----------|------------------------|
| Últimos e-mails | `GET /me/messages?$top=N&$select=…` | `Mail.Read` |
| Resumo dos e-mails | mesma busca + cascata LLM | `Mail.Read` + IA conectada |
| Mensagens recentes no Teams | chats/messages Graph (escopo estreito) | `Chat.Read` (ou equivalente mínimo) |
| Abrir Outlook / site | Tipo A (`open`) — sem Graph | — |

Autenticação: **MSAL / OAuth 2 PKCE** no desktop (mesmo espírito do Spotify PKCE, ADR 0007). App registration no Entra ID; redirect local loopback.

---

## O que **não** fazer

| Anti-padrão | Por quê |
|-------------|---------|
| RPA / clicar na UI do Outlook | Frágil, sem allowlist clara, quebra com update |
| Scraping de outlook.live.com | ToS, sessão, 2FA, segurança |
| Dar ao LLM uma tool “executar qualquer Graph” | Mass assignment / over-scope |
| Guardar corpos de e-mail no histórico para sempre | Vazamento em export / backup |
| Pedir `Mail.ReadWrite` / send no primeiro conector | Menor privilégio: **só leitura** no MVP |

---

## Ordem de construção sugerida

1. **Fase A** — loop voz + opens compostos + Spotify por nome (já no roadmap).  
2. **Contrato de conector** no código (interface + UI Integrações) — pode começar enxuto na Fase D/F.  
3. **Fase F1 — Outlook leitura** — OAuth + `list_recent` + lista na UI + TTS.  
4. **Fase F2 — Resumo** — mesma lista + LLM (cascata atual ou Fase E).  
5. **Fase F3 — Teams leitura** — mesmo molde, outros scopes.  
6. Só depois: responder e-mail, criar evento, etc. (write) com confirmação forte.

Detalhe de timing: [`roadmap.md`](./roadmap.md) → **Fase F**.

---

## Segurança (checklist)

- [ ] Scopes mínimos; tela de consentimento Microsoft visível  
- [ ] Tokens só em `safeStorage`; refresh sem logar secret  
- [ ] Operações allowlisted; parâmetros com Zod (ex.: `top` ≤ 10)  
- [ ] Confirmação falada antes de ler e-mail/Teams  
- [ ] LLM vê preview, não dump completo; prompt “não invente”  
- [ ] Export/apagar dados remove tokens + caches do conector  
- [ ] Label na UI: “Outlook · 5 mensagens” / “Resumo via OpenRouter (cota grátis)”

---

## Relação com o que já existe

| Peça atual | Papel |
|------------|--------|
| Intent router PT-BR | Porta de entrada — novas lanes `connector:*` |
| Spotify PKCE | Modelo de auth a copiar |
| Cascata IA | Resumos e prosa (não busca o e-mail) |
| Integrações (UI) | Onde “Conectar Outlook / Teams” mora |
| Opens desktop | “Abre o site X” continua Tipo A |

---

## Resposta curta à pergunta “como fazemos e-mail?”

1. Conectar Outlook com Microsoft (OAuth).  
2. Em “últimos e-mails”, chamar Graph com `Mail.Read` e trazer N mensagens.  
3. Mostrar a lista no Elio.  
4. Se pediu resumo, passar de/assunto/preview para a IA conectada e **falar** o resumo.  
5. Nunca deixar a IA “navegar” no Outlook sozinha — só operações que nós listamos.
