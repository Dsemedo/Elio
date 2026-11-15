# ADR 0002 — STT via subprocess `whisper-cli` (OD-02)

## Status

Aceito (atualizado 2026-11-15: modelo **small** + `-l pt` + `--prompt` PT-BR; confirmação breve na Floating Bar — PJ-25)

## Contexto

OD-02 aprovou Whisper.cpp via **subprocess** do binário oficial `whisper-cli`, sem bindings Node (`nodejs-whisper` / `whisper-node`). OD-06 mantém **download no 1º uso** com progresso. Feedback Douglas: `tiny`/`base` ainda manglam PT-BR em frases compostas → default **small** multilíngue. Após STT, janela curta de confirmação/edição evita disparar intents errados.

## Decisão

| Item | Valor |
|------|--------|
| Integração | `child_process.spawn` no **main** (`shell: false`, argv em array) |
| Binário pin | whisper.cpp **v1.9.2** — `whisper-bin-x64.zip` (Windows) / `whisper-bin-ubuntu-x64.tar.gz` (Linux) |
| Extract Windows | `tar.exe -xf` (bsdtar Win10+) no `.zip`; fallback `Expand-Archive`; limpeza temp best-effort (não mascara erro) |
| Download Windows | arquivo `.part` **único** em `whisper/tmp/` (não reusa `*.partial` travado por Defender/`EPERM`) |
| Modelo default | `ggml-small.bin` (~466 MB) via HF `resolve/main/...?download=true` (multilíngue; `-l pt`) |
| Override | `ELIO_WHISPER_MODEL=tiny\|base\|small` |
| Legado | `ggml-tiny.bin` / `ggml-base.bin` não são mais usados; usuário pode apagar em `%APPDATA%\elio\whisper\models\` |
| Onde fica | `%APPDATA%\elio\whisper\` (userData) — binário + modelo + WAV temp |
| Empacote | **não** embute o modelo no instalador; download sob demanda |
| CLI | `whisper-cli -m <model> -f <wav> -l pt --prompt "<PT-BR>" -otxt -of <out> -np -nt` |
| Pós-STT | Transcript na Floating Bar / composer ~2,8 s para conferir/editar; Enter envia agora; Esc cancela; edição cancela o auto-envio |

## Consequências

- Zero acoplamento de ABI com Electron 45.3.2.
- Cold start por PTT (modelo carrega a cada chamada) — `small` é mais lento/pesado que `base`, mas bem mais legível em PT-BR.
- 1ª preparação de voz baixa ~466 MB (internet uma vez).
- Falha do Whisper não derruba o processo Electron; chat texto segue.
- Renderer só envia WAV em base64; nunca vê path do binário.
- Logs sem conteúdo de fala e sem path completo do usuário.
- Ações de desktop (abrir pastas/browser) **fora** deste ADR / MVP voz.
