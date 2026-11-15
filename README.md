# Elio

Assistente pessoal de IA para desktop (**JARVIS MVP** — Estágio 1).  
Este repositório começa no **Sprint 0**: app Electron abre com isolamento seguro do renderer. Ainda **não** há chat nem voz.

## Requisitos

- **Windows 10/11 (x64)** — plataforma alvo do MVP  
- **Node.js 20 LTS ou 22 LTS** ([download](https://nodejs.org/))  
- npm vem junto com o Node

> Linux/macOS: `npm run dev` e `npm run build` funcionam para desenvolvimento; o instalador NSIS é para Windows.

## Como rodar (Windows)

No PowerShell ou Prompt de Comando, na pasta do projeto:

```bat
node -v
npm -v
npm install
npm run dev
```

Deve abrir uma janela com a marca **Elio** e um texto de fundação (hello / Sprint 0).

### Se algo falhar no Windows

1. Confirme que o Node é 20+ (`node -v`).
2. Delete `node_modules` e `package-lock.json`, depois `npm install` de novo.
3. Se o antivírus bloquear o Electron, permita a pasta do projeto / o executável em `node_modules\electron\dist\`.
4. Use um terminal **fora** do WSL se quiser a janela nativa do Windows (WSL abre display Linux/X11, se houver).

## Scripts úteis

| Comando | O que faz |
|---------|-----------|
| `npm run dev` | Sobe o app em modo desenvolvimento |
| `npm run build` | Compila main / preload / renderer |
| `npm test` | Smoke tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript estrito |
| `npm run dist:win` | Build + instalador NSIS (rode no Windows) |

## Segurança (Sprint 0)

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- Preload mínimo via `contextBridge` (`window.elio.getAppInfo`)
- CSP no `index.html`

## Versão do Electron

Pin atual: **45.3.2** (mais recente da linha 45 no npm).  
A decisão OD-01 pedia **45.3.3**, que ainda não existia no registry — ver `docs/ADRs/0001-electron-version.md`. Fallback: **44.11.3**.

## Escopo atual

Incluído: janela Elio, tooling (TS estrito, ESLint, Prettier, Vitest), config electron-builder NSIS.  
**Fora** deste sprint: chat, voz/Whisper, roteador de modelos, keytar, memória.

## Licença

UNLICENSED — uso privado por enquanto.
