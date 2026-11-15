# ADR 0002 — STT via subprocess `whisper-cli` (OD-02)

## Status

Aceito

## Contexto

OD-02 aprovou Whisper.cpp via **subprocess** do binário oficial `whisper-cli`, sem bindings Node (`nodejs-whisper` / `whisper-node`). OD-05/OD-06 preferem modelo **tiny** multilíngue e **download no 1º uso** com progresso.

## Decisão

| Item | Valor |
|------|--------|
| Integração | `child_process.spawn` no **main** (`shell: false`, argv em array) |
| Binário pin | whisper.cpp **v1.9.2** — `whisper-bin-x64.zip` (Windows) / `whisper-bin-ubuntu-x64.tar.gz` (Linux) |
| Modelo default | `ggml-tiny.bin` (multilíngue; `-l pt`) |
| Onde fica | `%APPDATA%\elio\whisper\` (userData) — binário + modelo + WAV temp |
| Empacote | **não** embute o modelo no instalador; download sob demanda |
| CLI | `whisper-cli -m <model> -f <wav> -l pt -otxt -of <out> -np` |

## Consequências

- Zero acoplamento de ABI com Electron 45.3.2.
- Cold start por PTT (modelo carrega a cada chamada) — aceitável no MVP.
- Falha do Whisper não derruba o processo Electron; chat texto segue.
- Renderer só envia WAV em base64; nunca vê path do binário.
- Logs sem conteúdo de fala e sem path completo do usuário.
