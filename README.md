# Elio

**Companheiro de voz no desktop Windows.**  
Você fala, ele responde **com som**, confirma e **age no PC** — Spotify, apps, sites — com limites claros de segurança.

> Elio ouve e decide no PC, responde com voz, confirma e age — com allowlist. Nuvem só com chave do usuário.

| Documento | Conteúdo |
|-----------|----------|
| **[`docs/produto.md`](./docs/produto.md)** | O quê, para quem, o que não é, princípios |
| **[`docs/roadmap.md`](./docs/roadmap.md)** | Fases A–F (incl. A0a–A0c), DoD, o que está estacionado |
| **[`docs/ADRs/0019-local-stt-brain-cascade-byok.md`](./docs/ADRs/0019-local-stt-brain-cascade-byok.md)** | Decisão: STT + cérebro locais; cascata só BYOK |
| **[`docs/melhoria-latencia-voz-pos-kobi.md`](./docs/melhoria-latencia-voz-pos-kobi.md)** | Guia / brief de implementação voz + latência |
| **[`docs/conectores.md`](./docs/conectores.md)** | Como agir no PC e em apps (Outlook, Teams, …) |
| **[`docs/analise-jarvis.md`](./docs/analise-jarvis.md)** | O que pegar de OpenJarvis / Jev (referência) |

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
| Floating Bar + Command Center | **A0:** STT local novo + cérebro local + escalate BYOK |
| Sherpa STT (pt-BR) + TTS | **Loop demo:** TTS + confirmação falada |
| Abrir app / site / pasta / browser + site | Opens compostos + Spotify por nome |
| Digitar + teclas/atalhos allowlist | Conversa multi-turno; wake word depois |
| Spotify (PKCE + play por **nome**) | Multi-IA nativa = **Fase E** (após A0) |
| Cascata de IA (OpenRouter / Ollama) | Só pedidos escalados + chave do usuário |

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

STT primário: Sherpa-ONNX local pt-BR (`auto`). Whisper = fallback.  
Override: `$env:ELIO_STT_PROVIDER = "auto"` \| `"sherpa"` \| `"whisper"` \| `"windows-speech"`.  
Cérebro local + cascata BYOK: [ADR 0019](./docs/ADRs/0019-local-stt-brain-cascade-byok.md).

### Integrações opcionais

| Integração | Para quê |
|------------|----------|
| OpenRouter / Ollama | Pedidos pesados / chat legado (cascata BYOK → free → local); não é o ouvido |
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
