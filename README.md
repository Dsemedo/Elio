# Elio

Assistente pessoal de IA para desktop (**JARVIS MVP**).  
**v0.10.0** — Spotify por voz (PKCE + fallback URI); inclui Whisper **small**, confirmação STT e localização automática do clima (0.9.0).

Spec UI: [`docs/elio-design-system.md`](./docs/elio-design-system.md) · ADRs: [`docs/ADRs/`](./docs/ADRs/)

## Requisitos

- **Windows 10/11 (x64)**  
- **Node.js 22.12+**  
- Microfone (voz)  
- Internet: 1ª vez da voz (~**466 MB** Whisper **small**) e clima (Open-Meteo + opcional IP geo)  
- Localização do Windows (opcional; se negar, usa IP aproximado)  
- (Opcional) [Ollama](https://ollama.com) com um modelo (ex.: `llama3.2`)  
- (Opcional) Spotify Premium + Client ID para play remoto por API

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

### O que Douglas deve ver (0.10.0)

1. Selo **v0.10.0**  
2. **Preparar voz** / 1º PTT: download do modelo **small** (~466 MB) se ainda não tiver  
3. Floating Bar: segurar mic → falar → **texto aparece para conferir** (~3 s) → envia sozinho (Enter agora / Esc cancela / editar cancela auto-envio)  
4. **“toca uma música no Spotify”** → abre o Spotify; se conectado + Premium → tenta play remoto; barra mostra “Abrindo Spotify…”  
5. **“como está o tempo?”** → Windows pode pedir localização → clima da **sua cidade**  
6. Opens seguros (“abre o site da Exame” / “abre a pasta Downloads”) e lane C (aba) **em breve**

### Conectar Spotify (Windows)

1. Crie um app em [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard).  
2. Em Redirect URIs, adicione **exatamente**: `http://127.0.0.1:47821/callback`  
3. Copie o **Client ID** (não precisa de Client Secret — usamos PKCE).  
4. No PowerShell, antes do `npm run dev`:

```powershell
$env:ELIO_SPOTIFY_CLIENT_ID = "seu-client-id"
npm run dev
```

5. No Elio: **Configurações → Integrações → Conectar Spotify** (ou diga “conectar Spotify”).  
6. Faça login no browser; volte ao Elio.  
7. Abra o app Spotify neste PC. Conta **Premium** é necessária para o play remoto pela API; conta Free → o Elio abre o app e avisa.

Tokens ficam cifrados em `%APPDATA%\elio\secrets\` (Electron `safeStorage`). Nunca vá para o log.

### Como testar localização no Windows

1. **Configurações → Privacidade e segurança → Localização** → ativar *Serviços de localização*  
2. Na 1ª pergunta de clima, aceitar o diálogo do Windows / Chromium  
3. Confirmar que a resposta cita a cidade certa (ex.: Goiânia)  
4. Para retestar o pedido: apague `%APPDATA%\elio\elio-location.json` e pergunte o clima de novo  
5. Para forçar fallback IP: negue a permissão no diálogo

### Modelo de intents

| Lane | Exemplos | Status |
|------|----------|--------|
| **A** PC | abre site / pasta / arquivo / app; **Spotify play/connect** | ✅ allowlist + PKCE |
| **B** Fato local | hora, clima | ✅ enrich (Open-Meteo + relógio + geo) |
| **C** Web context | aba aberta, pesquisa web | ⏳ deferred (extensão/CDP) |
| **D** Chat | conversa geral | ✅ LLM (Ollama / OpenRouter) |

**Não neste PR:** busca de música na UI, redesenho do Command Center, ler aba do browser, RPA.

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
| `ELIO_SPOTIFY_CLIENT_ID` | Client ID Spotify (PKCE; sem secret) |

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
Spotify: PKCE + `safeStorage`; opens só `spotify:` / `https://open.spotify.com`.  
Ver `docs/ADRs/0002-whisper-subprocess.md`, `0006-auto-location-weather.md` e `0007-spotify-voice-pkce.md`.

## Licença

UNLICENSED — uso privado por enquanto.
