# Elio

Assistente pessoal de IA para desktop (**JARVIS MVP** — Estágio 1).  
Produto: **Elio**. Agora com **conversa por texto** (Ollama local → OpenRouter → aviso para configurar).

## Requisitos

- **Windows 10/11 (x64)** — plataforma alvo do MVP  
- **Node.js 22.12+** ([download](https://nodejs.org/))  
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

(`git restore` descarta mudança local no lockfile que impede o `checkout`. Se quiser guardar a mudança: `git stash push -m "lock" -- package-lock.json` em vez de `restore`.)

Deve abrir a janela **Elio** com a tela de chat e o selo **v0.2.0** no canto do cabeçalho.

### Se ainda aparecer “FUNDAÇÃO · BASE DO APP”

Você **não** está no `main` atual (ou está abrindo um `.exe` antigo). Cole no PowerShell e mande o resultado:

```powershell
git status; git rev-parse HEAD; git log -1 --oneline; git branch -vv
```

Confirme: branch `main`, último commit fala de chat / PR #2 (ou versão 0.2.0).  
Feche atalhos/instaladores em `dist\` / `release\` — use só `npm run dev`.

### Testar o chat

1. **Com Ollama (recomendado, sem chave):**  
   - Instale e abra o Ollama.  
   - No terminal: `ollama pull llama3.2`  
   - No Elio, escreva uma mensagem e clique **Enviar**.  
   - A resposta deve vir do modelo local; o selo mostra `ollama · …`.

2. **Sem Ollama, com OpenRouter:**  
   - Crie uma chave em [openrouter.ai](https://openrouter.ai).  
   - No PowerShell, **antes** de `npm run dev`:

```bat
set OPENROUTER_API_KEY=sk-or-v1-SUA_CHAVE
npm run dev
```

   - (PowerShell moderno: `$env:OPENROUTER_API_KEY="sk-or-v1-SUA_CHAVE"`)

3. **Sem Ollama e sem chave:**  
   - O app abre normalmente.  
   - Ao enviar, aparece um erro/aviso pedindo para instalar o Ollama ou configurar a chave.  
   - Nada secreto é gravado em log.

### Se algo falhar no Windows

**Erro `Electron uninstall`:**

```bat
npm run ensure:electron
npm run dev
```

1. Confirme Node **22.12+** (`node -v`).
2. Feche janelas do Elio / Electron.
3. Antivírus: permita `node_modules\electron\dist\`.
4. Use terminal **fora** do WSL.

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
- IPC com canais fixos + validação **Zod** no main
- Chaves só por variável de ambiente neste pedaço (keytar depois); **não** vão para logs

## Persistência

Conversas em arquivo JSON em `%APPDATA%\elio\` (userData do Electron).  
SQLite + drizzle: follow-up (evitamos native rebuild neste PR).

## Versão do Electron

Pin: **45.3.2** — ver `docs/ADRs/0001-electron-version.md`.

## Escopo atual

Incluído: chat texto, threads, cancelar resposta, roteador Ollama→OpenRouter.  
Fora: voz, keytar UI, budget cap completo, memória explícita, instalador para leigos.

## Licença

UNLICENSED — uso privado por enquanto.
