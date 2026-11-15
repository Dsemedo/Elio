# Elio

Assistente pessoal de IA para desktop (**JARVIS MVP** — Estágio 1).  
Produto: **Elio**. Conversa por **texto** e **voz → texto** (Whisper local).  
**v0.4.0** — shell com **barrinha flutuante** + **painel** (Conversar, Histórico, Integrações, Computador).

## Requisitos

- **Windows 10/11 (x64)** — plataforma alvo do MVP  
- **Node.js 22.12+** ([download](https://nodejs.org/))  
- Microfone (para voz)  
- Internet **só na primeira vez** que usar a voz (baixa Whisper + modelo tiny, ~80 MB)  
- (Opcional) **[Ollama](https://ollama.com)** instalado e aberto, com um modelo (ex.: `ollama pull llama3.2`)

## Como rodar (Windows)

Pasta correta (só uma cópia): `C:\Users\Douglas\Elio`  
Não use outro clone em Downloads, Desktop ou OneDrive.

No PowerShell, **nessa** pasta:

```powershell
git restore package-lock.json
git checkout main
git pull
npm install
npm run ensure:electron
npm run dev
```

Deve aparecer:

1. Uma **barrinha** no topo (~20% da largura) com o nome **Elio**  
2. Um ícone do Elio na **bandeja** (canto da barra de tarefas)  
3. Ao **clicar na barrinha**, o **painel** abre/fecha  

Confirme o selo **v0.4.0** no painel (nav à esquerda).

### O que testar no painel

| Seção | O que deve funcionar |
|-------|----------------------|
| **Conversar** | Chat por texto + botão **Falar** (voz → texto), igual às versões anteriores |
| **Histórico** | Lista de conversas; clicar abre em Conversar; excluir / nova |
| **Integrações** | Status de Ollama / OpenRouter; Slack e Jira como **em breve** (ainda sem login) |
| **Computador** | Memória, CPU aproximada, SO — atualiza sozinho; **não** lista apps que mais pesam |

### Barrinha some / como voltar

- Se você focar **outro app**, a barrinha e o painel **tendem a sumir** (best-effort no Windows).  
- Para **voltar**: clique no ícone do Elio na **bandeja** → **Mostrar Elio**.  
- Atalho de teclado global ainda **não** está definido (decisão OD-20 aberta).  
- Limitações: ver `docs/ADRs/0003-shell-overlay.md`.

### Testar a voz (STT)

1. Em **Conversar**, clique em **Preparar voz** (ou segure **Falar** — na primeira vez baixa sozinho).  
2. Espere o progresso (~80 MB: binário + modelo `tiny`).  
3. **Segure** o botão **Falar**, diga uma frase em português, **solte**.  
4. O texto deve aparecer na caixa. Revise e clique **Enviar**.

Tudo fica em `%APPDATA%\elio\whisper\` — **áudio e texto da fala não saem deste PC**.

### Testar o chat por texto

1. **Com Ollama (recomendado, sem chave):** instale/abra o Ollama, `ollama pull llama3.2`, envie uma mensagem.  
2. **Com OpenRouter:**

```powershell
$env:OPENROUTER_API_KEY="sk-or-v1-SUA_CHAVE"
npm run dev
```

3. **Sem provedor:** o app abre; ao enviar, aviso para configurar.

### Se algo falhar no Windows

**Erro `Electron uninstall`:**

```bat
npm run ensure:electron
npm run dev
```

1. Confirme Node **22.12+** (`node -v`).
2. Feche janelas do Elio / Electron.
3. Antivírus: permita `node_modules\electron\dist\` e `%APPDATA%\elio\whisper\`.
4. Use terminal **fora** do WSL.
5. Se a barrinha não voltar: bandeja → **Mostrar Elio** ou **Sair** e `npm run dev` de novo.

## Scripts úteis

| Comando | O que faz |
|---------|-----------|
| `npm run dev` | Sobe o app em modo desenvolvimento |
| `npm run build` | Compila main / preload / renderer |
| `npm test` | Testes (Vitest) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript estrito |
| `npm run dist:win` | Build + instalador NSIS (Windows) |

## Segurança

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Preload mínimo (CJS) via `contextBridge`
- IPC com canais fixos + validação **Zod** no main (chat, voz, shell, sistema)
- Subprocess Whisper **só no main** (`shell: false`)
- Chaves só por variável de ambiente neste pedaço (keytar depois); **não** vão para logs
- Logs sem conteúdo de fala e sem path completo do usuário

## Persistência

- Conversas: `%APPDATA%\elio\elio-chat.json`  
- Whisper: `%APPDATA%\elio\whisper\` (binário, modelo, temp)

## Versão do Electron

Pin: **45.3.2** — ver `docs/ADRs/0001-electron-version.md`.  
STT: subprocess `whisper-cli` — ver `docs/ADRs/0002-whisper-subprocess.md`.  
Shell overlay: `docs/ADRs/0003-shell-overlay.md`.

## Escopo atual (v0.4.0)

**Funciona:** barrinha + painel, chat, voz→texto, histórico, status IA, snapshot básico do PC, bandeja.  
**Stub / depois:** OAuth Slack/Jira, análise profunda de desempenho, atalho global (OD-20), abrir apps/pastas.

## Licença

UNLICENSED — uso privado por enquanto.
