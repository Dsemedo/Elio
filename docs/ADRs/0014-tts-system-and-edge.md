# ADR 0014 — TTS: system (Windows) + edge-tts (PJ-36)

## Status

Aceito (2026-11-15) · versão **0.15.1**

## Contexto

O PRD e a arquitetura pedem TTS opcional via **edge-tts**, com interrupção, sem escuta contínua. Douglas quer caminho **gratuito / local-friendly** e least privilege. A Floating Bar / Command Center UX de outros agents não deve ser redesenhada — só toggle leve + stop.

Alternativas:

| Opção | Prós | Contras |
|-------|------|---------|
| **A. speechSynthesis (renderer)** | Offline; usa vozes SAPI/OneCore do Windows; sem rede; alinhado ao STT Web Speech | Qualidade depende das vozes instaladas pt-BR |
| **B. edge-tts (main, protocolo Edge Read Aloud)** | Voz neural pt-BR; sem API key; gratuito | Precisa rede; protocolo Microsoft pode mudar (`Sec-MS-GEC`) |
| **C. Python edge-tts CLI** | Biblioteca madura | Dependência Python no runtime Windows — evitar |
| **D. Addon nativo SAPI** | Controle fino | Packaging / ABI com Electron |

## Decisão

1. **Toggle off por padrão** (prefs em `%APPDATA%\elio\elio-tts.json`).
2. **auto:** system se houver voz `pt*` no `speechSynthesis`; senão **edge-tts**.
3. **system:** só Web Speech Synthesis no renderer (Windows SAPI/OneCore).
4. **edge:** síntese MP3 no **main** via WebSocket Edge Read Aloud → base64 → `HTMLAudioElement` no renderer. Sem gravar texto em disco; SSML escapado.
5. **Stop / interrupt:** `speechSynthesis.cancel()` + abort WS + pause audio. Botão na Floating Bar e em Integrações.
6. Env override (debug/CI): `ELIO_TTS_ENABLED`, `ELIO_TTS_PROVIDER`, `ELIO_TTS_EDGE_VOICE`.
7. UI mínima: menu da barra (“Falar respostas”) + card em Configurações → Integrações. Estado visual `speaking` (accent pulsante leve).

## Consequências

- Offline funciona com pacote de voz pt-BR do Windows.
- edge-tts não exige key; falha de rede → mensagem amigável (e auto tenta system se possível).
- Sem Python, sem shell, sem Node no renderer.
- Logs/IPC não registram o texto falado além do necessário para a síntese em memória.
- Se a Microsoft alterar o token GEC, o caminho **system** continua.
