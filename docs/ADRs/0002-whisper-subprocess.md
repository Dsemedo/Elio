# ADR 0002 — STT via subprocess `whisper-cli` (OD-02)

## Status

Aceito (atualizado 2026-11-15: modelo **base** + `-l pt`; OD-05 fechado para PT-BR)

## Contexto

OD-02 aprovou Whisper.cpp via **subprocess** do binário oficial `whisper-cli`, sem bindings Node (`nodejs-whisper` / `whisper-node`). OD-06 mantém **download no 1º uso** com progresso. Feedback Douglas: `tiny` mangla PT-BR → default **base** multilíngue.

## Decisão

| Item | Valor |
|------|--------|
| Integração | `child_process.spawn` no **main** (`shell: false`, argv em array) |
| Binário pin | whisper.cpp **v1.9.2** — `whisper-bin-x64.zip` (Windows) / `whisper-bin-ubuntu-x64.tar.gz` (Linux) |
| Extract Windows | `tar.exe -xf` (bsdtar Win10+) no `.zip`; fallback `Expand-Archive`; limpeza temp best-effort (não mascara erro) |
| Modelo default | `ggml-base.bin` via HF `resolve/main/...?download=true` (multilíngue; `-l pt`) |
| Legado | `ggml-tiny.bin` não é mais usado; usuário pode apagar em `%APPDATA%\elio\whisper\models\` |
| Onde fica | `%APPDATA%\elio\whisper\` (userData) — binário + modelo + WAV temp |
| Empacote | **não** embute o modelo no instalador; download sob demanda |
| CLI | `whisper-cli -m <model> -f <wav> -l pt -otxt -of <out> -np -nt` |
| Pós-STT (MVP) | Auto-envio do transcript ao pipeline de chat (Floating Bar + Command Center) |

## Consequências

- Zero acoplamento de ABI com Electron 45.3.2.
- Cold start por PTT (modelo carrega a cada chamada) — aceitável no MVP; `base` é mais lento/pesado que `tiny`, mas legível em PT-BR.
- Falha do Whisper não derruba o processo Electron; chat texto segue.
- Renderer só envia WAV em base64; nunca vê path do binário.
- Logs sem conteúdo de fala e sem path completo do usuário.
- Ações de desktop (abrir pastas/browser) **fora** deste ADR / MVP voz.
