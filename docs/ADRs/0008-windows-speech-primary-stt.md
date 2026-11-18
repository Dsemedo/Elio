# ADR 0008 — Windows Speech (opcional); Whisper como `auto` provisório (PJ-31 → revisão)

## Status

**Supersedido em direção (2026-11-18) por [ADR 0019](./0019-local-stt-brain-cascade-byok.md); A0a implementado:** `auto` = **Sherpa-ONNX** (NeMo CTC pt-BR) via subprocess. Whisper = fallback / `ELIO_STT_PROVIDER=whisper`. Web Speech / Windows Speech Runtime no renderer permanece **fora** do `auto` (só force `ELIO_STT_PROVIDER=windows-speech`).

Motivo histórico do Whisper-as-auto (2026-11-16): no Electron do Douglas o Web Speech seguia em “Não ouvi nada” — **não** reabrir patches nesse stack.

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

## Decisão (atual — A0a)

1. **Primário (`auto` / `sherpa`):** Sherpa-ONNX `sherpa-onnx-offline` + modelo NeMo CTC pt-BR int8 ([ADR 0019](./0019-local-stt-brain-cascade-byok.md)).
2. **Fallback:** se Sherpa falhar no ensure/transcribe → Whisper (ADR 0002). Force: `ELIO_STT_PROVIDER=whisper`.
3. **Windows Speech (renderer):** só com `ELIO_STT_PROVIDER=windows-speech` (e API disponível). Sem WAV paralelo no caminho Speech.
4. **Auto-envio** imediato após transcript válido. **Sem** janela de confirmar/editar.
5. Override: `ELIO_STT_PROVIDER=auto|sherpa|whisper|windows-speech`.
6. Melhoria via Whisper `medium`/`large` ou STT cloud na conta do vendedor: **rejeitado** (ADR 0019).

## Consequências

- 1º PTT baixa Sherpa (~binário + ~126 MB modelo) em `%APPDATA%\elio\sherpa\`.
- Whisper permanece instalável como fallback (userData/whisper).
- Caminho Speech experimental continua só com force — **não** é o default.
