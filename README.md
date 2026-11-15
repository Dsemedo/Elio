# Elio

Assistente pessoal de IA para desktop (**JARVIS MVP**).  
**v0.13.0** — Command Center UX (threads ao lado, histórico com busca/renomear, Ollama/OpenRouter na UI). Inclui fix Speech `not-allowed` (0.12.1), NSIS + auto-update (0.12.0) e Windows Speech (0.11.0).

Spec UI: [`docs/elio-design-system.md`](./docs/elio-design-system.md) · ADRs: [`docs/ADRs/`](./docs/ADRs/) · Distribuição: [`docs/windows-distribution.md`](./docs/windows-distribution.md)

## Requisitos

- **Windows 10/11 (x64)**  
- **Node.js 22.12+** (só para desenvolvimento)  
- Microfone (voz)  
- Pacote de idioma de fala **pt-BR** do Windows (reconhecimento nativo)  
- Internet: só se o fallback Whisper for usado na 1ª vez (~**466 MB**) e para clima  
- Localização do Windows (opcional; se negar, usa IP aproximado)  
- (Opcional) [Ollama](https://ollama.com) com um modelo (ex.: `llama3.2`)  
- (Opcional) Spotify Premium + Client ID para play remoto por API

## Instalar (usuário — sem Node)

1. Baixe `Elio-*-Setup.exe` em [Releases](https://github.com/Dsemedo/Elio/releases).  
2. Se o SmartScreen avisar: **Mais informações** → **Executar assim mesmo** (builds ainda unsigned).  
3. Conclua o assistente NSIS (atalhos desktop/menu).  
4. Atualizações chegam sozinhas; feche e abra o Elio quando avisar.

Publicar / assinar / `npm run dist:win`: veja [`docs/windows-distribution.md`](./docs/windows-distribution.md).

## Como rodar (Windows, desenvolvimento)

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

### O que Douglas deve ver (0.13.0)

1. Selo **v0.13.0**  
2. Command Center → **Conversas**: lista de threads **ao lado** do chat  
3. Header do chat limpo (título + Nova + status)  
4. Aba **Histórico**: busca por título, renomear (✎ / duplo clique), confirmar exclusão  
5. **Início**: Continuar conversa + Nova conversa  
6. **Configurações → Integrações**: Ollama (verificar) + OpenRouter (salvar chave no cofre) + cidade do clima  
7. Floating Bar: Windows Speech → **envia sozinho**; se permissão falhar → **“Usando Whisper…”** (sem `WINDOWS_SPEECH_ERROR:not-allowed`)  
8. `npm run dist:win` gera instalador NSIS; Spotify / clima das versões anteriores continuam ok

### OpenRouter / Ollama na UI

Em **Configurações → Integrações** você pode:

- Ajustar host/modelo do Ollama e clicar **Verificar de novo**  
- Colar a chave OpenRouter — fica cifrada em `%APPDATA%\elio\secrets\openrouter-key.bin`  
- Preferências não secretas em `%APPDATA%\elio\elio-settings.json`  

`OPENROUTER_API_KEY` / `OLLAMA_*` no ambiente ainda funcionam e **têm prioridade** sobre o cofre/arquivo.

### Microfone / fala no Windows (se aparecer permissão negada)

1. **Configurações → Privacidade e segurança → Microfone** → ativar *Acesso ao microfone* e permitir apps de desktop  
2. **Configurações → Hora e idioma → Fala** (ou *Speech*) → pacote de idioma **português (Brasil)** com reconhecimento de fala  
3. Se o Windows perguntar na 1ª vez, **Permitir** microfone/fala para o Elio  
4. Reinicie o Elio (`npm run dev`) e segure o mic de novo  
5. Se ainda falhar: o Elio cai no Whisper sozinho nesse PTT (aguarde “Usando Whisper…”)

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

Tokens ficam cifrados em `%APPDATA%\elio\secrets\` (Electron `safeStorage` **async**). Nunca vão para o log.

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

**Não neste PR:** TTS, ler aba do browser, BYOK cascade, mudanças de STT/installer (já em main).

### Clima e fuso

Ordem de resolução:

1. `ELIO_WEATHER_LAT` + `ELIO_WEATHER_LON` (ou `ELIO_WEATHER_CITY`)  
2. Cidade salva em Configurações (`elio-settings.json`)  
3. Cache local da localização OS (`elio-location.json`)  
4. Fallback IP (`ipwho.is`) se a permissão OS for negada/falhar  
5. Último recurso: São Paulo (`fallback`)

| Variável | Efeito |
|----------|--------|
| `ELIO_WEATHER_CITY` | Cidade (geocode Open-Meteo), ex.: `Campinas` |
| `ELIO_WEATHER_LAT` + `ELIO_WEATHER_LON` | Coordenadas (prioridade sobre cidade) |
| `ELIO_TIMEZONE` | Fuso IANA (padrão `America/Sao_Paulo`) |
| `ELIO_WHISPER_MODEL` | `tiny` / `base` / `small` (padrão `small`; só fallback) |
| `ELIO_STT_PROVIDER` | `auto` (padrão) / `windows-speech` / `whisper` |
| `ELIO_SPOTIFY_CLIENT_ID` | Client ID Spotify (PKCE; sem secret) |
| `OPENROUTER_API_KEY` | Chave nuvem (prioridade sobre cofre da UI) |

### Privacidade (localização)

- Preferimos a API de localização do Windows (com seu consentimento).  
- Se negar: usamos IP público só para aproximar cidade — o endpoint vê o IP (como qualquer site).  
- O LLM recebe **só o nome da cidade**, não lat/lon.  
- Cache fica só em `%APPDATA%\elio\` neste PC.

## Voz (Windows Speech + Whisper fallback)

- **Primário (Windows):** Web Speech API no renderer → Windows Speech Runtime, `lang: pt-BR` (ADR 0008)  
- **Fallback:** `whisper-cli` (whisper.cpp **v1.9.2**) + `ggml-small.bin` (~466 MB) com `-l pt` (ADR 0002)  
- Override STT: `$env:ELIO_STT_PROVIDER = "whisper"` força só Whisper  
- Após STT: **auto-envio** (sem confirmar/editar)  
- Pasta Whisper: `%APPDATA%\elio\whisper\`  
- Áudio/texto **não vão para servidor nosso**

### Como testar STT no Windows

1. Confirme idioma de fala pt-BR em **Configurações → Hora e idioma → Fala**  
2. `npm run dev` → selo **v0.13.0**  
3. Segure o mic na Floating Bar → diga *“Qual é o clima atual do lugar que eu moro?”* → solte  
4. O texto deve ir **direto** ao chat (sem caixa “Confira o texto”)  
5. Preferência: “atual” **não** vira “outdoor”  
6. (Opcional) forçar Whisper: `$env:ELIO_STT_PROVIDER = "whisper"` e repetir  
7. (Opcional) “Preparar fallback” no Command Center baixa o Whisper sem falar

## Segurança

`contextIsolation`, sem `nodeIntegration`, sandbox, Zod IPC.  
STT: Windows Speech no renderer; Whisper subprocess só no main (`shell: false`).  
Clima: Open-Meteo + cache local; coords não vão ao histórico/LLM.  
Spotify / OpenRouter: PKCE + `safeStorage`; opens só `spotify:` / `https://open.spotify.com`.  
Ver `docs/ADRs/0002-whisper-subprocess.md`, `0006-auto-location-weather.md`, `0007-spotify-voice-pkce.md`, `0008-windows-speech-primary-stt.md`, `0009-windows-distribution.md` e `0010-command-center-ux-settings.md`.

## Licença

UNLICENSED — uso privado por enquanto.
