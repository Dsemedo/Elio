# Elio

Assistente pessoal de IA para desktop (**JARVIS MVP** — Estágio 1).  
**v0.6.0** — Whisper **base** (PT-BR) + **envio automático** ao chat; Floating Bar UX (voz primeiro, sem chrome duplo).

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
git checkout cursor/whisper-base-auto-send-b66e
git pull
npm install
npm run ensure:electron
npm run dev
```

### O que Douglas deve ver

1. **Floating Bar** ~420×58 **sem moldura preta** — idle “Segure o mic” + stub “Palavra de ativação · em breve”  
2. Segurar mic → **Ouvindo…** → soltar → **Transcrevendo…** → **Pensando…** → resposta (Ollama/OpenRouter)  
3. O texto **não fica parado no input** — após a transcrição o Elio **envia sozinho** ao chat  
4. Mesmo fluxo no **Command Center** (Conversas)  
5. Clicar em outro app: **barra permanece**; ocultar só pelo menu / bandeja  
6. Selo **v0.6.0**  
7. Na 1ª vez (ou se ainda tiver só o `tiny`): download do modelo **base** com progresso

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
