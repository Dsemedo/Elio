# Elio

Assistente pessoal de IA para desktop (**JARVIS MVP** — Estágio 1).  
**v0.6.2** — Fix EPERM no download do modelo (partial travado no Windows); Whisper **base** + envio automático ao chat.

Spec UI: [`docs/elio-design-system.md`](./docs/elio-design-system.md)

## Requisitos

- **Windows 10/11 (x64)**  
- **Node.js 22.12+**  
- Microfone (voz)  
- Internet só na 1ª vez da voz (~150 MB Whisper **base** + binário)  
- (Opcional) [Ollama](https://ollama.com) com um modelo

## Como rodar (Windows)

Pasta: `C:\Users\Douglas\Elio`

```powershell
git restore package-lock.json
git fetch
git checkout main
git pull
npm install
npm run ensure:electron
npm run dev
```

### O que Douglas deve ver

1. Selo **v0.6.2**  
2. **Preparar voz** → progresso (~150 MB) → “Voz pronta” (mesmo se existir `.partial` antigo travado)  
3. **Floating Bar** — idle “Segure o mic”; segurar → **Ouvindo…** → soltar → **Transcrevendo…** → **Pensando…** → resposta  
4. Texto da fala **envia sozinho** ao chat  
5. Se ainda falhar: mensagem sobre antivírus + log `EPERM`; opcional apagar `%APPDATA%\elio\whisper\models\*.partial` e a pasta `tmp`

**Não neste PR:** abrir pastas, browser ou ações no desktop (Estágio 2).

Se ocultar de propósito: bandeja → **Mostrar Elio**.

### Comportamento de foco

| Antes (0.5.0) | Agora |
|---------------|--------|
| Blur / outro app → escondia barra + painel | Blur → **só recolhe o painel**; **barra fica** |
| Voltar pela bandeja | Barra já no desktop; bandeja só se você ocultou |

## Voz (Whisper local)

- Binário: `whisper-cli` (whisper.cpp **v1.9.2**)  
- Modelo: **`ggml-base.bin`** (multilíngue) com idioma forçado **`-l pt`**  
- Pasta: `%APPDATA%\elio\whisper\`  
- Áudio e texto da fala **não saem deste PC**

### Migração do `tiny` (versões antigas)

Se você já usou a voz antes, o Elio baixa o **base** na próxima preparação.  
Pode **apagar o modelo antigo** para liberar espaço:

```text
%APPDATA%\elio\whisper\models\ggml-tiny.bin
```

(Opcional: apague só o `ggml-tiny.bin`; deixe `ggml-base.bin` e a pasta `bin`.)

## Segurança

`contextIsolation`, sem `nodeIntegration`, sandbox, Zod IPC.  
STT: subprocess `whisper-cli` só no main (`shell: false`).  
Ver `docs/ADRs/0002-whisper-subprocess.md`.

## Licença

UNLICENSED — uso privado por enquanto.
