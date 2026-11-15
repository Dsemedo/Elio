# Elio

Assistente pessoal de IA para desktop (**JARVIS MVP**).  
**v0.8.0** — Floating Bar opaca + erros legíveis; opens seguros (site/pasta/arquivo/app); router de intents A/B/C.

Spec UI: [`docs/elio-design-system.md`](./docs/elio-design-system.md) · ADR: [`docs/ADRs/0005-desktop-opens-intent-router.md`](./docs/ADRs/0005-desktop-opens-intent-router.md)

## Requisitos

- **Windows 10/11 (x64)**  
- **Node.js 22.12+**  
- Microfone (voz)  
- Internet: 1ª vez da voz (~150 MB Whisper **base**) e clima (Open-Meteo, sem chave)  
- (Opcional) [Ollama](https://ollama.com) com um modelo (ex.: `llama3.2`)

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

### O que Douglas deve ver (0.8.0)

1. Selo **v0.8.0**  
2. Floating Bar = cápsula grafite **opaca**; erro de mic **dentro** da barra (sem retângulo transparente sob a pill)  
3. **“abre o site da Exame”** → browser no https da Exame; feedback na barra + chat  
4. **“abre a pasta Downloads”** → Explorer na pasta; paths fora de home/comuns são bloqueados  
5. **“que horas são?”** / **“como está o tempo?”** → fatos locais (como em 0.7)  
6. Pedidos de “ler a aba aberta” → resposta honesta **em breve** (sem CDP/extensão neste release)

### Modelo de intents

| Lane | Exemplos | Status |
|------|----------|--------|
| **A** PC | abre site / pasta / arquivo / app | ✅ allowlist `openExternal` / `openPath` |
| **B** Fato local | hora, clima | ✅ enrich (Open-Meteo + relógio) |
| **C** Web context | aba aberta, pesquisa web | ⏳ deferred (extensão/CDP) |
| **D** Chat | conversa geral | ✅ LLM (Ollama / OpenRouter) |

**Não neste PR:** ler aba do browser, digitar em outros apps, apagar/mover arquivos, RPA completo.

### Clima e fuso (opcional)

| Variável | Efeito |
|----------|--------|
| `ELIO_WEATHER_CITY` | Cidade (geocode Open-Meteo), ex.: `Campinas` |
| `ELIO_WEATHER_LAT` + `ELIO_WEATHER_LON` | Coordenadas (prioridade sobre cidade) |
| `ELIO_TIMEZONE` | Fuso IANA (padrão `America/Sao_Paulo`) |

Exemplo PowerShell:

```powershell
$env:ELIO_WEATHER_CITY = "Campinas"
$env:ELIO_TIMEZONE = "America/Sao_Paulo"
npm run dev
```

Sem env: clima em **São Paulo**. Também documentado em Configurações → Integrações.

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
Clima: só Open-Meteo no processo main (sem key).  
Ver `docs/ADRs/0002-whisper-subprocess.md`.

## Licença

UNLICENSED — uso privado por enquanto.
