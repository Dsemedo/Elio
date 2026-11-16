# ADR 0008 — Windows Speech (opcional); Whisper primário (PJ-31 → revisão)

## Status

**Supersedido em parte (2026-11-16):** Whisper voltou a ser o STT **primário** em todas as plataformas (`auto`). Web Speech / Windows Speech Runtime permanece só com force explícito (`ELIO_STT_PROVIDER=windows-speech`). Motivo: no Electron do Douglas o Web Speech seguia em “Não ouvi nada” (0.16.1–0.16.2) apesar do mic do SO funcionar — bloqueava o loop demo. Manter um único caminho local (Whisper) também não fecha o Mac.

Histórico da decisão original (Speech primário no Windows) permanece abaixo como contexto.

## Contexto

Whisper `small` ainda mangla PT-BR em frases comuns (ex.: “atual” → “outdoor”). Douglas pediu STT **nativo/gratuito do Windows** como primário e **removeu** a UX de confirmar/editar transcript (~2,8 s) da 0.9.0 — quer auto-envio de novo após a fala.

Após merges 0.15.x–0.16.1 e tentativa 0.16.2 (restart adiado no `onend`), o PTT no Electron/Windows continuava sem transcript confiável. Gravador de Voz do SO OK → falha específica do stack Web Speech no app.

Alternativas reavaliadas:

| Opção | Prós | Contras |
|-------|------|---------|
| **A. Web Speech no renderer** | Zero ABI; no Win usa Speech Runtime | Instável no Electron do produto; Mac frágil |
| **B. Bridge nativo por OS** | Controle fino | Win COM + Mac SFSpeech = 2 stacks |
| **C. Whisper-first (subprocess)** | Já implementado; Win/Mac/Linux iguais; offline | Download ~466 MB; PT-BR do `small` imperfeito |
| **D. STT cloud** | Melhor PT-BR | Rede, custo, privacidade |

## Decisão (atual)

1. **Primário (`auto`):** Whisper via `whisper-cli` (ADR 0002) em **todas** as plataformas — inclusive Windows.
2. **Windows Speech:** só com `ELIO_STT_PROVIDER=windows-speech` (e API disponível). Sem WAV paralelo no caminho Speech (getUserMedia aberto + Speech → mic exclusivo no Electron).
3. **Auto-envio** imediato após transcript válido. **Sem** janela de confirmar/editar.
4. Override: `ELIO_STT_PROVIDER=auto|windows-speech|whisper` (main → `VoiceStatus.sttPreference`).
5. Melhoria de PT-BR do Whisper (modelo maior, cloud, híbrido) fica fora deste ADR — próximo passo de produto se o `small` incomodar o demo.

## Consequências

- 1º PTT no Windows pode baixar o modelo Whisper (~466 MB) se ainda não estiver em `%APPDATA%\elio\whisper\`.
- Mesmo fluxo de voz no Mac depois — sem amarrar o produto ao Speech Runtime.
- Caminho Speech experimental continua no código para quem forçar o env.
- ADR 0002: Whisper deixa de ser “só fallback” e volta a ser o **default** do produto.
