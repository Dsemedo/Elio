# Elio

**Companheiro de voz no desktop Windows.**  
Você fala, ele responde **com som**, confirma e **age no PC** — Spotify, apps, sites — com limites claros de segurança.

> Elio escuta, responde com voz, confirma e age no PC — com allowlist.

| Documento | Conteúdo |
|-----------|----------|
| **[`docs/produto.md`](./docs/produto.md)** | O quê, para quem, o que não é, princípios |
| **[`docs/roadmap.md`](./docs/roadmap.md)** | Fases A–D, DoD, o que está estacionado |

---

## A cena que importa

1. “Bom dia, Elio” → ele responde com voz: “Bom dia, como você está?”  
2. “Toca [música] no Spotify” → “Estou colocando agora” → a música toca  
3. “Abre o Edge e o Instagram” → confirma e abre

Hoje o microfone ainda é **segurar para falar** (PTT). Wake word (“Ei, Elio”) só depois das Fases A–B do roadmap.

---

## O que já existe × foco agora

| Já tem base | Foco (Fase A — nesta ordem) |
|-------------|------------------------------|
| Floating Bar + Command Center | TTS na experiência de voz + confirmação falada |
| Whisper STT (local) | Spotify por **nome da faixa** |
| Abrir app / site / pasta (1 alvo) | Comandos compostos (Edge + Instagram) |
| Spotify (PKCE / play parcial) | Só então: multi-turno → wake word |
| Cascata de IA (OpenRouter / Ollama) | Agentes / Atividades / Slack = **estacionados** |

Detalhe técnico: [`docs/ADRs/`](./docs/ADRs/) · UI: [`docs/elio-design-system.md`](./docs/elio-design-system.md)

---

## Instalar (usuário)

1. Baixe `Elio-*-Setup.exe` em [Releases](https://github.com/Dsemedo/Elio/releases).  
2. Se o SmartScreen avisar: **Mais informações** → **Executar assim mesmo** (builds ainda sem assinatura).  
3. Conclua o instalador. Atualizações avisam dentro do app.

Distribuição / assinatura: [`docs/windows-distribution.md`](./docs/windows-distribution.md).

---

## Desenvolver (Windows)

**Requisitos:** Windows 10/11 x64 · Node.js 22.12+ · microfone.

```powershell
git clone https://github.com/Dsemedo/Elio.git
cd Elio
npm install
npm run ensure:electron
npm run dev
```

### Voz e TTS (rápido)

1. **Configurações → Privacidade → Microfone** — apps de desktop permitidos.  
2. No Elio: ligue **Falar respostas** (menu da barra / Integrações) para ouvir o Elio.  
3. Segure o mic → fale → solte.

STT primário: Whisper local (mesmo caminho no Windows e no Mac).  
Override opcional: `$env:ELIO_STT_PROVIDER = "whisper"` \| `"windows-speech"` \| `"auto"`.

### Integrações opcionais

| Integração | Para quê |
|------------|----------|
| OpenRouter / Ollama | Conversa (cascata BYOK → free → local) |
| Spotify Premium + Client ID | Play remoto (`ELIO_SPOTIFY_CLIENT_ID`) |
| Localização Windows | Clima da sua cidade |

Variáveis e detalhes: ver comentários em [`.env.example`](./.env.example) e o README histórico nas ADRs.

### Scripts úteis

```powershell
npm test
npm run typecheck
npm run dist:win   # instalador NSIS
```

---

## Princípios (resumo)

- **Demo do loop primeiro** — se não dá para mostrar em ~30 s, a fatia está errada.  
- **Pedido por voz → resposta falada** (salvo modo silencioso).  
- **Confirmar e agir** — allowlist, sem `exec` arbitrário.  
- **PT-BR do dia a dia.**  
- **Público agora:** dogfooding do Douglas; ICP secundário só depois do loop estável.

Fonte completa: [`docs/produto.md`](./docs/produto.md) · ordem de build: [`docs/roadmap.md`](./docs/roadmap.md).

---

## Licença

`UNLICENSED` — projeto privado de Douglas Semedo Neto.
