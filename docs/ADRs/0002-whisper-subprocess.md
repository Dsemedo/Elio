# ADR 0002 — STT via subprocess `whisper-cli` (OD-02)

## Status

Aceito como **integração técnica** (subprocess).  
**Papel de produto revisado 2026-11-18 ([ADR 0019](./0019-local-stt-brain-cascade-byok.md) / A0a):** Whisper é **fallback degradado** (`ELIO_STT_PROVIDER=whisper` ou se Sherpa falhar). Primário = Sherpa-ONNX.

## Contexto

OD-02 aprovou Whisper.cpp via **subprocess** do binário oficial `whisper-cli`, sem bindings Node. OD-06 mantém **download no 1º uso** com progresso. Feedback Douglas: `tiny`/`base` manglam PT-BR → default **small**. PJ-31 chegou a colocar Windows Speech como primário (ADR 0008); na prática o Web Speech no Electron não sustentou o loop demo → Whisper voltou a ser o **default** no código. ADR 0019 redefine o alvo: STT local novo (Sherpa/Vosk ou COM); Whisper só se ainda fizer sentido como fallback. Windows Speech / Web Speech continua fora do `auto`.

## Decisão

| Item | Valor |
|------|--------|
| Papel no produto | **Fallback degradado** (`auto` = Sherpa — ADR 0019/0008). Windows Speech só com force |
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
- Cold start por chamada no caminho Whisper (contribui para estourar metas ≤2–3 s — motivo do ADR 0019).
- Falha do Whisper não derruba o processo Electron; chat texto segue.
- Renderer só envia WAV em base64; nunca vê path do binário.
- Logs sem conteúdo de fala e sem path completo do usuário.
- **Não** tratar `medium`/`large` como solução de produto (ADR 0019 / guia).
