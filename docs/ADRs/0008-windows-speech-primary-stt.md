# ADR 0008 — Windows Speech primário; Whisper só fallback (PJ-31)

## Status

Aceito (2026-11-15)

## Contexto

Whisper `small` ainda mangla PT-BR em frases comuns (ex.: “atual” → “outdoor”). Douglas pediu STT **nativo/gratuito do Windows** como primário e **removeu** a UX de confirmar/editar transcript (~2,8 s) da 0.9.0 — quer auto-envio de novo após a fala.

Alternativas:

| Opção | Prós | Contras |
|-------|------|---------|
| **A. Web Speech API no renderer** (`SpeechRecognition` / `webkitSpeechRecognition`, `lang: pt-BR`) | Zero ABI; no Electron/Chromium no Windows usa o Windows Speech Runtime; sem download; PTT simples | Depende do Chromium expor a API; qualidade/OS; em Linux costuma ser cloud (não usamos como primário fora do win32) |
| **B. Bridge nativo main → Windows Speech Runtime** | Controle fino | Addon/COM, packaging, manutenção |
| **C. Manter Whisper-first + confirmação** | Já implementado | Qualidade PT-BR insuficiente; Douglas rejeitou a UI de confirmação |

## Decisão

1. **Primário no Windows:** Web Speech API no **renderer** (`lang: 'pt-BR'`, PTT hold-to-talk). Escolhemos A — suficiente no Electron 45 no Windows; evita bridge nativo.
2. **Fallback:** subprocess `whisper-cli` existente (ADR 0002) quando SpeechRecognition indisponível, erro recuperável, ou texto vazio — WAV paralelo no PTT permite cair no Whisper sem pedir nova fala.
3. **Auto-envio** imediato após transcript válido (Floating Bar + Command Center). **Sem** janela de confirmar/editar.
4. Override: `ELIO_STT_PROVIDER=auto|windows-speech|whisper` (lido no main, exposto em `VoiceStatus.sttPreference`).
5. Fora do Windows (dev Linux/CI): Whisper permanece o caminho padrão (`auto`).

## Consequências

- 1º PTT no Windows **não** exige download de ~466 MB.
- “Preparar fallback” / `ensureVoice` só baixa Whisper quando o usuário prepara offline ou quando o fallback dispara.
- Qualidade PT-BR depende do pacote de idioma de fala do Windows (pt-BR).
- Privacidade no caminho primário: áudio tratado pelo stack de fala do OS/Chromium no Windows (não enviamos a um servidor nosso). Whisper fallback continua 100% local.
- ADR 0002 permanece válido para o **caminho Whisper** (subprocess); deixa de ser o STT default no produto Windows.
- A sessão Electron deve conceder `media`/`microphone` (além de `geolocation`); um handler só-geo produz `not-allowed` no Speech **sem** chegar ao prompt do Windows. O handler libera o Chromium; o consentimento do SO vem do `getUserMedia`.
- Ordem PTT: **getUserMedia → SpeechRecognition** (mic-first). Permissão negada (`not-allowed` / `service-not-allowed` / SO `denied`) → **chip PT-BR**, sem Whisper silencioso. Whisper só após falha explícita do Speech (rede, áudio, sem texto, …), com status “Speech falhou (…) — Whisper”.
- UI nunca mostra `WINDOWS_SPEECH_ERROR:…` cru.
