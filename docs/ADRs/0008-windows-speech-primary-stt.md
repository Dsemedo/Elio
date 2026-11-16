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
2. **Fallback:** subprocess `whisper-cli` (ADR 0002) só quando o Speech **falha ao iniciar** (rede/áudio/indisponível). **Não** usar WAV paralelo durante o Speech: no Electron/Windows, `getUserMedia` aberto ao mesmo tempo deixa o Speech Runtime sem áudio → “não ouvi nada”. Fluxo: `primeMicPermission` → libera tracks → Speech sozinho. Texto vazio / `no-speech` → pedir nova fala (Whisper mangla PT-BR).
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
- Ordem PTT (**0.16.2**): `primeMicPermission` — se mic já `granted`, não reabre getUserMedia; senão getUserMedia curto + **libera** tracks + settle → **SpeechRecognition sozinho**. Manter getUserMedia aberto durante o Speech no Electron/Windows → mic exclusivo → texto vazio. Permissão negada → chip PT-BR. Whisper só se o Speech falhar ao **iniciar**. `no-speech`/vazio → pedir nova fala. Durante o hold, `no-speech`/`onend` reiniciam com **delay** (nunca `start()` síncrono no `onend` — quirk Chromium).
- UI nunca mostra `WINDOWS_SPEECH_ERROR:…` cru.
- Pós-0.15.5: margem de finalização do Speech no `stop()` ~**4 s**; fallback Whisper usa `-bs 8`, prompt com “clima atual” e `normalizeWhisperPtBr`.
