# Elio

Assistente pessoal de IA para desktop (**JARVIS MVP** — Estágio 1).  
Produto: **Elio**. Conversa por **texto** e **voz → texto** (Whisper local via `whisper-cli`).

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

Deve abrir a janela **Elio** com o chat e o selo **v0.3.0**.

### Testar a voz (STT)

1. Clique em **Preparar voz** (ou segure **Falar** — na primeira vez baixa sozinho).  
2. Espere o progresso (~80 MB: binário + modelo `tiny`).  
3. **Segure** o botão **Falar**, diga uma frase em português, **solte**.  
4. O texto deve aparecer na caixa de mensagem. Revise e clique **Enviar**.

**O que é baixado (1ª vez, pasta local do app):**

- `whisper-cli` (whisper.cpp **v1.9.2**)  
- modelo **`ggml-tiny.bin`** (multilíngue)  

Tudo fica em `%APPDATA%\elio\whisper\` — **áudio e texto da fala não saem deste PC**.

**Erros comuns**

| Situação | O que fazer |
|----------|-------------|
| Sem permissão de mic | Windows → Configurações → Privacidade → Microfone → permitir para o terminal/Electron |
| Áudio muito curto | Segure o botão e fale pelo menos ~1 segundo |
| Whisper / download falhou | Confira internet; clique **Preparar voz** de novo |
| Sem Ollama / sem chave | A voz ainda preenche o texto; para **responder**, use Ollama ou OpenRouter |

### Testar o chat por texto

1. **Com Ollama (recomendado, sem chave):**  
   - Instale e abra o Ollama.  
   - `ollama pull llama3.2`  
   - Envie uma mensagem no Elio.

2. **Sem Ollama, com OpenRouter:**  

```powershell
$env:OPENROUTER_API_KEY="sk-or-v1-SUA_CHAVE"
npm run dev
```

3. **Sem Ollama e sem chave:** o app abre; ao enviar, aviso para configurar. Nada secreto vai para o log.

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
- Subprocess Whisper **só no main** (`shell: false`); renderer nunca vê o path do binário
- Chaves só por variável de ambiente neste pedaço (keytar depois); **não** vão para logs
- Logs sem conteúdo de fala e sem path completo do usuário

## Persistência

- Conversas: `%APPDATA%\elio\elio-chat.json`  
- Whisper: `%APPDATA%\elio\whisper\` (binário, modelo, temp)

## Versão do Electron

Pin: **45.3.2** — ver `docs/ADRs/0001-electron-version.md`.  
STT: subprocess `whisper-cli` — ver `docs/ADRs/0002-whisper-subprocess.md`.

## Escopo atual

Incluído: chat texto, threads, cancelar resposta, roteador Ollama→OpenRouter, **voz → texto (PTT)**.  
Fora deste pedaço: TTS completo, atalho global minimizado, keytar UI, budget cap completo, memória explícita.

## Licença

UNLICENSED — uso privado por enquanto.
