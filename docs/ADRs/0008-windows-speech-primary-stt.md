# ADR 0008 — Windows Speech (opcional); Whisper como `auto` provisório (PJ-31 → revisão)

## Status

**Supersedido em direção (2026-11-18) por [ADR 0019](./0019-local-stt-brain-cascade-byok.md):** o *alvo* de `auto` deixa de ser Whisper. Alvo = STT local novo (Sherpa-ONNX / Vosk pt-BR, ou helper COM Windows fora do Chromium). Whisper = fallback degradado. Web Speech / Windows Speech Runtime no renderer permanece **fora** do `auto` (só force `ELIO_STT_PROVIDER=windows-speech`).

**Estado do código até A0a:** Whisper ainda é o `auto` em todas as plataformas (decisão operacional de 2026-11-16). Motivo histórico: no Electron do Douglas o Web Speech seguia em “Não ouvi nada” (0.16.1–0.16.2) apesar do mic do SO funcionar — bloqueava o loop demo. **Não** reabrir patches nesse stack Web Speech.

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

## Decisão (histórica 2026-11-16 → supersedida em alvo por ADR 0019)

1. **Código atual (`auto`):** Whisper via `whisper-cli` (ADR 0002) em **todas** as plataformas — inclusive Windows — até o PR A0a.
2. **Alvo de produto (`auto`):** STT local novo ([ADR 0019](./0019-local-stt-brain-cascade-byok.md)); Whisper só fallback; Web Speech ≠ `auto`.
3. **Windows Speech (renderer):** só com `ELIO_STT_PROVIDER=windows-speech` (e API disponível). Sem WAV paralelo no caminho Speech (getUserMedia aberto + Speech → mic exclusivo no Electron).
4. **Auto-envio** imediato após transcript válido. **Sem** janela de confirmar/editar.
5. Override atual: `ELIO_STT_PROVIDER=auto|windows-speech|whisper` (main → `VoiceStatus.sttPreference`) — será estendido quando o STT novo entrar.
6. Melhoria via Whisper `medium`/`large` ou STT cloud na conta do vendedor: **rejeitado** (ADR 0019).

## Consequências

- 1º PTT no Windows ainda pode baixar o modelo Whisper (~466 MB) enquanto Whisper for o `auto` no código.
- Caminho Speech experimental continua no código para quem forçar o env — **não** é o default.
- Próximo PR de STT deve atualizar `sttPolicy` + este ADR + ADR 0002 para refletir o backend novo como `auto`.
