# Elio

Assistente pessoal de IA para desktop (**JARVIS MVP**).  
**v0.9.0** — Whisper **small** + confirmação de transcript; localização automática para clima.

Spec UI: [`docs/elio-design-system.md`](./docs/elio-design-system.md) · ADRs: [`0002`](./docs/ADRs/0002-whisper-subprocess.md), [`0006`](./docs/ADRs/0006-auto-location-weather.md)

## Requisitos

- **Windows 10/11 (x64)**  
- **Node.js 22.12+**  
- Microfone (voz)  
- Internet: 1ª vez da voz (~**466 MB** Whisper **small**) e clima (Open-Meteo + opcional IP geo)  
- Localização do Windows (opcional; se negar, usa IP aproximado)  
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

### O que Douglas deve ver (0.9.0)

1. Selo **v0.9.0**  
2. **Preparar voz** / 1º PTT: download do modelo **small** (~466 MB) se ainda não tiver  
3. Floating Bar: segurar mic → falar → **texto aparece para conferir** (~3 s) → envia sozinho (Enter agora / Esc cancela / editar cancela auto-envio)  
4. **“como está o tempo?”** → Windows pode pedir localização → clima da **sua cidade** (não São Paulo fixo)  
5. Se negar localização → fallback por IP (aproximado); ver privacidade abaixo  
6. Opens seguros e Floating Bar 0.8.0 continuam iguais

### Como testar localização no Windows

1. **Configurações → Privacidade e segurança → Localização** → ativar *Serviços de localização*  
2. Na 1ª pergunta de clima, aceitar o diálogo do Windows / Chromium  
3. Confirmar que a resposta cita a cidade certa (ex.: Goiânia)  
4. Para retestar o pedido: apague `%APPDATA%\elio\elio-location.json` e pergunte o clima de novo  
5. Para forçar fallback IP: negue a permissão no diálogo

### Modelo de intents

| Lane | Exemplos | Status |
|------|----------|--------|
| **A** PC | abre site / pasta / arquivo / app | ✅ allowlist `openExternal` / `openPath` |
| **B** Fato local | hora, clima | ✅ enrich (Open-Meteo + relógio + geo) |
| **C** Web context | aba aberta, pesquisa web | ⏳ deferred (extensão/CDP) |
| **D** Chat | conversa geral | ✅ LLM (Ollama / OpenRouter) |

**Não neste PR:** ler aba do browser, BYOK cascade, redesign.

### Clima e fuso

Ordem de resolução:

1. `ELIO_WEATHER_LAT` + `ELIO_WEATHER_LON` (ou `ELIO_WEATHER_CITY`)  
2. Cache local da localização OS (`elio-location.json`)  
3. Fallback IP (`ipwho.is`) se a permissão OS for negada/falhar  
4. Último recurso: São Paulo (`fallback`)

| Variável | Efeito |
|----------|--------|
| `ELIO_WEATHER_CITY` | Cidade (geocode Open-Meteo), ex.: `Campinas` |
| `ELIO_WEATHER_LAT` + `ELIO_WEATHER_LON` | Coordenadas (prioridade sobre cidade) |
| `ELIO_TIMEZONE` | Fuso IANA (padrão `America/Sao_Paulo`) |
| `ELIO_WHISPER_MODEL` | `tiny` / `base` / `small` (padrão `small`) |

### Privacidade (localização)

- Preferimos a API de localização do Windows (com seu consentimento).  
- Se negar: usamos IP público só para aproximar cidade — o endpoint vê o IP (como qualquer site).  
- O LLM recebe **só o nome da cidade**, não lat/lon.  
- Cache fica só em `%APPDATA%\elio\` neste PC.

## Voz (Whisper local)

- Binário: `whisper-cli` (whisper.cpp **v1.9.2**)  
- Modelo: **`ggml-small.bin`** (~466 MB, multilíngue) com **`-l pt`** e **`--prompt`** PT-BR  
- Override: `$env:ELIO_WHISPER_MODEL = "base"`  
- Pasta: `%APPDATA%\elio\whisper\`  
- Após STT: confirmação breve na barra/composer antes do auto-envio  
- Áudio e texto da fala **não saem deste PC**

### Migração de modelos antigos

Na próxima preparação o Elio baixa o **small**. Pode apagar os antigos:

```text
%APPDATA%\elio\whisper\models\ggml-tiny.bin
%APPDATA%\elio\whisper\models\ggml-base.bin
```

## Segurança

`contextIsolation`, sem `nodeIntegration`, sandbox, Zod IPC.  
STT: subprocess `whisper-cli` só no main (`shell: false`).  
Clima: Open-Meteo + cache local; coords não vão ao histórico/LLM.  
Ver `docs/ADRs/0002-whisper-subprocess.md` e `0006-auto-location-weather.md`.

## Licença

UNLICENSED — uso privado por enquanto.
