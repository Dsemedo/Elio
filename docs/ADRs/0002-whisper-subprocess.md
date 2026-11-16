# ADR 0002 — STT via subprocess `whisper-cli` (OD-02)

## Status

Aceito (atualizado 2026-11-16: modelo **small**; **primário** de novo — ADR 0008 revisado)

## Contexto

OD-02 aprovou Whisper.cpp via **subprocess** do binário oficial `whisper-cli`, sem bindings Node. OD-06 mantém **download no 1º uso** com progresso. Feedback Douglas: `tiny`/`base` manglam PT-BR → default **small**. PJ-31 chegou a colocar Windows Speech como primário (ADR 0008); na prática o Web Speech no Electron não sustentou o loop demo → Whisper voltou a ser o **default** em todas as plataformas. Windows Speech fica só com force explícito.

## Decisão

| Item | Valor |
|------|--------|
| Papel no produto | **Primário** STT (`auto`); Windows Speech só com force (ADR 0008) |
| Integração | `child_process.spawn` no **main** (`shell: false`, argv em array) |
| Binário pin | whisper.cpp **v1.9.2** — `whisper-bin-x64.zip` (Windows) / `whisper-bin-ubuntu-x64.tar.gz` (Linux) |
| Extract Windows | `tar.exe -xf` (bsdtar Win10+) no `.zip`; fallback `Expand-Archive`; limpeza temp best-effort |
| Download Windows | arquivo `.part` **único** em `whisper/tmp/` |
| Modelo default | `ggml-small.bin` (~466 MB) via HF (multilíngue; `-l pt` + `--prompt` PT-BR) |
| Override | `ELIO_WHISPER_MODEL=tiny\|base\|small` |
| Onde fica | `%APPDATA%\elio\whisper\` (userData) |
| Empacote | **não** embute o modelo; download no 1º uso / “Preparar voz” |
| CLI | `whisper-cli -m <model> -f <wav> -l pt --prompt "<PT-BR>" -bs 8 -otxt -of <out> -np -nt` |
| Pós-STT | `normalizeWhisperPtBr` (ex.: clima outdoor→atual; descarta alucinações curtas) + auto-envio (sem gate confirmar/editar — PJ-31) |

## Consequências

- Zero acoplamento de ABI com Electron 45.3.2.
- Cold start por chamada no caminho Whisper.
- Falha do Whisper não derruba o processo Electron; chat texto segue.
- Renderer só envia WAV em base64; nunca vê path do binário.
- Logs sem conteúdo de fala e sem path completo do usuário.
