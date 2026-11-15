# Elio

Assistente pessoal de IA para desktop (**JARVIS MVP** — Estágio 1).  
**v0.7.0** — chat scrollável no Command Center; hora local + clima (Open-Meteo); sync Bar ↔ Painel.

Spec UI: [`docs/elio-design-system.md`](./docs/elio-design-system.md)

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

### O que Douglas deve ver

1. Selo **v0.7.0**  
2. Em **Conversas**: lista de mensagens **rola** (rodinha / barra); mensagens novas vão ao fim se você já estava no fundo  
3. Perguntar **“que horas são?”** → hora real (fuso `America/Sao_Paulo` ou `ELIO_TIMEZONE`)  
4. Perguntar **“como está o tempo?”** → clima real (padrão São Paulo; ver env abaixo)  
5. Voz ou texto na Floating Bar atualiza o chat do Command Center (mesma conversa)

**Não neste PR:** abrir pastas, browser ou ações no desktop (Estágio 2 / PJ-20).

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
